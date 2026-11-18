
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');

const source = readFileSync(require.resolve('../public/forum.js'), 'utf8');
const category = '技术分析';
const key = user => 'ice-atlas:forum-draft:v1:' + user;
const postId = 'a'.repeat(24);

function editor({user = 'account-a', records = new Map(), request, writeFails = false} = {}) {
  const fields = {disabled: false};
  const restore = {hidden: false};
  const discard = {focus() { this.focused = true; }};
  const cancelDiscard = {focus() { this.focused = true; }};
  const confirmDiscard = {};
  const discardFeedback = {};
  const dialogControls = {'[data-delete-cancel]':cancelDiscard, '[data-delete-confirm]':confirmDiscard, '.forum-delete-feedback':discardFeedback};
  const discardDialog = {
    open:false, querySelector:selector => dialogControls[selector],
    showModal() { this.open = true; },
    close() { this.open = false; this.onclose(); }
  };
  const status = {dataset: {}};
  const button = {};
  const feedback = {};
  const prompt = {hidden: true, querySelector: selector => {
    if (selector.includes('restore')) return restore;
    if (selector.includes('discard')) return discard;
    return {};
  }};
  const selectors = {
    fieldset: fields,
    '.forum-delete-dialog': discardDialog,
    '.forum-draft-prompt': prompt,
    '.forum-draft-status': status,
    '.forum-feedback': feedback,
    'button[type="submit"]': button
  };
  const form = Object.assign(new EventTarget(), {
    dataset: {},
    elements: Object.fromEntries(['title', 'content', 'category'].map(name =>
      [name, Object.assign(new EventTarget(), {name, value: name === 'category' ? '赛事讨论' : '', focus() {}})])),
    reportValidity: () => true,
    querySelector: selector => selectors[selector],
    isConnected: true
  });
  const location = {hash: '#/forum?view=new'};
  const window = Object.assign(new EventTarget(), {confirm: () => false});
  const document = Object.assign(new EventTarget(), {querySelector: () => form});
  const sandbox = {
    authUser: {id: user, nickname: '同一个昵称'}, currentRoute: '/forum',
    blankCanvas: {}, window, document, location, AbortController, AbortSignal,
    apiRequest: request, escapeText: String,
    localStorage: {
      getItem: name => records.get(name) ?? null,
      setItem(name, value) {
        if (writeFails) throw new Error('QuotaExceededError');
        records.set(name, value);
      },
      removeItem: name => records.delete(name)
    }
  };
  runInNewContext(source + '\nrenderForumCompose();', sandbox);
  return {
    records, status, restore, discard, discardDialog, cancelDiscard, confirmDiscard, discardFeedback, feedback, prompt, fields, window, location,
    set(name, value) {
      const field = form.elements[name];
      field.value = value;
      if (name === 'category') field.dispatchEvent(new Event('change'));
      else {
        const event = new Event('input');
        Object.defineProperty(event, 'target', {value: field});
        form.dispatchEvent(event);
      }
    },
    values: () => Object.fromEntries(Object.entries(form.elements).map(([name, field]) => [name, field.value])),
    publish: () => form.onsubmit({preventDefault() {}}),
    close: () => runInNewContext('leaveForumCompose()', sandbox)
  };
}

const original = {title: '标题', content: '未发布的正文', category};
function fill(page, values = original) {
  for (const [name, value] of Object.entries(values)) page.set(name, value);
}

test('已有本地草稿 → 重新打开发帖页 → 确认后还原标题、正文、分类', () => {
  const first = editor();
  fill(first);
  assert.match(first.status.textContent, /草稿已保存/);
  const keyA = key('account-a');
  const saved = first.records.get(keyA);
  assert.ok(JSON.parse(saved).updatedAt > 0);
  assert.deepEqual(Object.keys(JSON.parse(saved)).sort(), ['category', 'content', 'title', 'updatedAt']);
  first.close();
  const reopened = editor({records: first.records});
  assert.equal(reopened.fields.disabled, true);
  assert.equal(reopened.values().title, '');
  reopened.window.dispatchEvent(new Event('pagehide'));
  assert.equal(first.records.get(keyA), saved);
  reopened.restore.onclick();
  assert.deepEqual(reopened.values(), original);
  assert.equal(reopened.fields.disabled, false);
});

test('编辑器中断网 → 继续输入 → 无需请求服务器即可保存并恢复', () => {
  let requests = 0;
  const page = editor({request: () => { requests++; throw new Error('offline'); }});
  fill(page);
  const reloaded = editor({records: page.records});
  reloaded.restore.onclick();
  assert.deepEqual(reloaded.values(), original);
  assert.equal(requests, 0);
});

test('发布返回明确错误 → 显示服务器反馈并保留草稿', async () => {
  const error = Object.assign(new Error('帖子输入无效'), {status: 400});
  const page = editor({request: async () => { throw error; }});
  fill(page);
  const before = page.records.get(key('account-a'));
  await page.publish();
  assert.equal(page.feedback.textContent, error.message);
  assert.equal(page.records.get(key('account-a')), before);
});

test('等待发布结果时保留草稿 → 服务器确认后清理 → 离开和隐藏事件不写回', async () => {
  let resolve;
  const page = editor({request: () => new Promise(done => { resolve = done; })});
  fill(page);
  const posting = page.publish();
  assert.equal(page.records.has(key('account-a')), true);
  assert.equal(page.fields.disabled, true);
  resolve({id: postId});
  await posting;
  page.window.dispatchEvent(new Event('pagehide'));
  page.close();
  assert.equal(page.records.size, 0);
  assert.equal(page.location.hash, '/forum?post=' + postId);
});

test('请求超时、5xx 或无法验证的成功响应 → 保留草稿并提示先核对，不自动重发', async () => {
  for (const request of [
    async () => { throw new Error('timeout'); },
    async () => { throw Object.assign(new Error('gateway'), {status: 502}); },
    async () => ({})
  ]) {
    let calls = 0;
    const page = editor({request: () => { calls++; return request(); }});
    fill(page);
    await page.publish();
    assert.match(page.feedback.textContent, /无法确认帖子是否已发布/);
    assert.equal(page.records.has(key('account-a')), true);
    await page.publish();
    assert.equal(calls, 1);
  }
});

test('同昵称的不同账号先后打开编辑器 → 各自只能恢复自己的草稿', () => {
  const a = editor();
  fill(a);
  a.close();
  const b = editor({user: 'account-b', records: a.records});
  assert.equal(b.prompt.hidden, true);
  assert.equal(b.values().title, '');
  b.set('title', '账号 B');
  b.close();
  const returned = editor({records: a.records});
  returned.restore.onclick();
  assert.deepEqual(returned.values(), original);
  assert.equal(JSON.parse(a.records.get(key('account-b'))).title, '账号 B');
});

test('写入失败或已有数据损坏 → 显示错误，放弃必须确认', () => {
  const failed = editor({writeFails: true});
  fill(failed);
  assert.equal(failed.status.dataset.state, 'error');
  assert.match(failed.status.textContent, /草稿保存失败/);
  assert.equal(failed.records.size, 0);
  const records = new Map([[key('account-a'), '{damaged']]);
  const damaged = editor({records});
  assert.equal(damaged.status.dataset.state, 'error');
  assert.equal(damaged.restore.hidden, true);
  damaged.discard.onclick();
  assert.equal(damaged.discardDialog.open, true);
  assert.equal(damaged.cancelDiscard.focused, true);
  damaged.cancelDiscard.onclick();
  assert.equal(damaged.discard.focused, true);
  assert.equal(records.get(key('account-a')), '{damaged');
  damaged.discard.onclick();
  damaged.confirmDiscard.onclick();
  assert.equal(damaged.discardDialog.open, false);
  assert.equal(records.size, 0);
  assert.equal(damaged.fields.disabled, false);
});

test('另一个标签页写入新版本 → 旧编辑器提交成功也不能删除新版本', async () => {
  const page = editor({request: async () => ({id: postId})});
  fill(page);
  const newVersion = JSON.stringify({...original, title: '新版本', updatedAt: Date.now()});
  page.records.set(key('account-a'), newVersion);
  page.set('content', '旧页面继续编辑');
  assert.match(page.status.textContent, /其他版本/);
  await page.publish();
  page.close();
  assert.equal(page.records.get(key('account-a')), newVersion);
});
