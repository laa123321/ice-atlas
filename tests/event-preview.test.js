const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/season.js'),'utf8');
const render=vm.runInNewContext(source+'\nnextEventPreview',{setInterval:()=>{}});
const event={id:'example',name:'动态赛事名称',city:'深圳',country:'CHN',series:'gp',group:'senior',start:'2026-11-06',end:'2026-11-08',podium:[]};
test('票券读取动态赛事、起止日期和星期；跨月跨年与单日均可显示',()=>{
 const html=render(event);
 for(const value of ['动态赛事名称','深圳','成年组','2026 年 11 月','>06<','>08<','周五','周日','event=example'])assert.ok(html.includes(value),value);
 assert.ok(render({...event,start:'2026-12-31',end:'2027-01-02'}).includes('2026.12 — 2027.01'));
 const oneDay=render({...event,end:event.start});assert.equal((oneDay.match(/<time /g)||[]).length,1);
 assert.equal(render(null),'');
});
test('图片接口拒绝外部路径，文本被转义，已结束状态仍按真实赛果计算',()=>{
 const html=render({...event,name:'<img onerror=x>',podium:[{},{},{}],preview:{image:'https://example.test/photo.jpg'}});
 assert.ok(html.includes('&lt;img onerror=x&gt;'));assert.ok(html.includes('已结束'));assert.ok(!html.includes('<img src='));
 const photo=render({...event,preview:{image:'assets/events/figure-skates-preview.jpg'}});
 assert.ok(photo.includes('<img src="assets/events/figure-skates-preview.jpg"'));
});
