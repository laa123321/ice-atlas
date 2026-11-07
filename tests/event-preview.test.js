const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/season.js'),'utf8');
const {render,selectFeaturedEvent}=vm.runInNewContext(source+'\n({render:nextEventPreview,selectFeaturedEvent})',{setInterval:()=>{}});
const event={id:'example',name:'动态赛事名称',city:'深圳',country:'CHN',series:'gp',group:'senior',start:'2026-11-06',end:'2026-11-08',podium:[]};
test('票券读取动态赛事、起止日期和星期；跨月跨年与单日均可显示',()=>{
 const html=render(event);
 for(const value of ['动态赛事名称','深圳','成年组','2026 年 11 月','>06<','>08<','周五','周日','event=example'])assert.ok(html.includes(value),value);
 assert.ok(render({...event,start:'2026-12-31',end:'2027-01-02'}).includes('2026.12 — 2027.01'));
 const oneDay=render({...event,end:event.start});assert.equal((oneDay.match(/<time /g)||[]).length,1);
 assert.equal(render(null),'');
});
test('图片接口拒绝外部路径，文本被转义，已结束状态仍按真实赛果计算',()=>{
 const html=render({...event,name:'<img onerror=x>',podium:[{},{},{}],preview:{image:'https://example.test/photo.jpg'}},'2026-11-09');
 assert.ok(html.includes('&lt;img onerror=x&gt;'));assert.ok(html.includes('已结束'));assert.ok(!html.includes('<img src='));
 const photo=render({...event,preview:{image:'assets/events/figure-skates-preview.jpg'}});
 assert.ok(photo.includes('<img src="assets/events/figure-skates-preview.jpg"'));
});
test('正在进行的赛事保留到结束日，女单赛果公布后也不会提前切换',()=>{
 const china={...event,id:'gpchn2026',podium:[{},{},{}]};
 const america={...event,id:'gpusa2026',start:'2026-11-13',end:'2026-11-15'};
 const events=[america,china];
 for(const day of ['2026-11-07','2026-11-08']){
  const featured=selectFeaturedEvent(events,day);
  assert.equal(featured,china);
  assert.match(render(featured,day),/CURRENT EVENT \/ 进行中.*正在进行/);
 }
 assert.equal(selectFeaturedEvent(events,'2026-11-09'),america);
 assert.match(render(america,'2026-11-09'),/NEXT EVENT \/ 下一场.*即将开始/);
 assert.equal(selectFeaturedEvent(events,'2026-11-16'),undefined);
});
