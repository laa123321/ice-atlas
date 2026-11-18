
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');

const source = readFileSync(require.resolve('../public/forum.js'), 'utf8');
const post = {_id:'a'.repeat(24),isOwner:true,title:'测试讨论',content:'正文',category:'技术分析',author:'作者',createdAt:'2026-11-18T00:00:00Z',comments:[]};

function detail({user = {id:'owner'}, isOwner = true, request = async () => ({deleted:true})} = {}) {
  const trigger = {focus() { this.focused = true; }};
  const item = {};
  const button = {disabled:false};
  const cancel = {focus() { this.focused = true; }};
  const menu = {open:true, contains:target => target === item, querySelector:selector => selector === 'summary' ? trigger : item};
  const feedback = {focus() {}};
  const controls = {'[data-delete-confirm]':button, '[data-delete-cancel]':cancel, '.forum-delete-feedback':feedback};
  const dialog = {
    open:false, querySelector:selector => controls[selector],
    showModal() { this.open = true; },
    close() { this.open = false; this.onclose(); }
  };
  const article = {isConnected:true,querySelector:selector => selector === '.forum-post-menu' ? menu : dialog};
  const blankCanvas = {querySelector:() => article};
  const location = {hash:'#/forum?post=' + post._id};
  const drafts = new Map([['ice-atlas:forum-draft:v1:owner','unpublished']]);
  const calls = [];
  const handlers = {};
  runInNewContext(source + '\nrenderForumDetail(post);', {
    post:{...post,isOwner}, authUser:user, blankCanvas, location, AbortSignal,
    document:{
      addEventListener(type, handler) { handlers[type] = handler; },
      querySelector:selector => selector === '.forum-post-menu[open]' ? (menu.open ? menu : null) : {}
    },
    escapeText:value => String(value), window:{addEventListener() {}},
    localStorage:{getItem:key => drafts.get(key),removeItem:key => drafts.delete(key)},
    apiRequest(...args) { calls.push(args); return request(...args); }
  });
  return {button,menu,item,cancel,dialog,trigger,handlers,feedback,location,drafts,calls,html:blankCanvas.innerHTML};
}

test('详情仅向当前登录的作者显示删除入口，取消确认不发送请求',async () => {
  assert.doesNotMatch(detail({user:null}).html,/删除帖子/);
  assert.doesNotMatch(detail({user:{id:'other'},isOwner:false}).html,/删除帖子/);
  const page = detail();
  assert.match(page.html,/删除帖子/);
  page.item.onclick();
  assert.equal(page.dialog.open,true);
  assert.equal(page.cancel.focused,true);
  assert.match(page.html,/帖子及其评论将一并移除/);
  page.cancel.onclick();
  assert.equal(page.dialog.open,false);
  assert.equal(page.trigger.focused,true);
  assert.equal(page.calls.length,0);
  assert.match(page.location.hash,/post=/);
});

test('等待删除时禁止重复提交，成功后返回列表并保留其他发帖草稿',async () => {
  let finish;
  const page = detail({request:() => new Promise(resolve => { finish=resolve; })});
  page.item.onclick();
  const pending = page.button.onclick();
  assert.equal(page.button.disabled,true);
  let prevented = false;
  page.dialog.oncancel({preventDefault() { prevented = true; }});
  assert.equal(prevented,true);
  await page.button.onclick();
  assert.equal(page.calls.length,1);
  assert.equal(page.calls[0][1].method,'DELETE');
  finish({deleted:true});
  await pending;
  assert.equal(page.location.hash,'/forum');
  assert.equal(page.dialog.open,false);
  assert.equal(page.drafts.get('ice-atlas:forum-draft:v1:owner'),'unpublished');
});

test('明确拒绝、连接中断或结果未确认时保留帖子详情并提示',async () => {
  const denied = detail({request:async () => {throw Object.assign(new Error('只有帖子作者可以删除这篇讨论。'),{status:403});}});
  denied.item.onclick();
  await denied.button.onclick();
  assert.match(denied.feedback.textContent,/只有帖子作者/);
  assert.match(denied.location.hash,/post=/);
  for (const request of [
    async () => { throw new Error('timeout'); },
    async () => { throw Object.assign(new Error('gateway'),{status:504}); },
    async () => ({})
  ]) {
    const page = detail({request});
    page.item.onclick();
    await page.button.onclick();
    assert.match(page.feedback.textContent,/无法确认.*返回讨论列表核对/);
    assert.match(page.location.hash,/post=/);
    assert.equal(page.button.disabled,false);
    assert.equal(page.dialog.open,true);
  }
});


test('菜单在外部点击或按 Escape 时关闭', () => {
  const page = detail();
  page.handlers.click({target:page.item});
  assert.equal(page.menu.open,true);
  page.handlers.click({target:{}});
  assert.equal(page.menu.open,false);
  page.menu.open = true;
  page.handlers.keydown({key:'Escape',preventDefault() {}});
  assert.equal(page.menu.open,false);
  assert.equal(page.trigger.focused,true);
});
