const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {MongoClient}=require('mongodb');
const {parseEventIndex,parseFinalResult,createSeasonService}=require('../src/season');
const {ensureLocalMongo}=require('../src/local-mongo');
const seed=require('../data/season-seed.json');
const event=seed.events.find(e=>e.id==='gpfra2026');
const indexHtml='<body>Angers 23.10.2026 - 25.10.2026<table><tr><td>Women</td><td></td><td><a href="CAT002EN.htm">Entries</a></td><td><a href="CAT002RS.htm">Result</a></td></tr></table></body>';
const names=['Ami NAKAI','Anastasiia GUBANOVA','Lara Naki GUTMANN'];
const scores=[219.74,202.82,202.37];
const rows=names.map((name,i)=>`<tr><td>${i+1}</td><td><a href="/bios/isufs0010000${i}.htm">${name}</a></td><td><table><tr><td><img alt=""></td><td>${['JPN','GEO','ITA'][i]}</td></tr></table></td><td>${scores[i]}</td><td>${i+1}</td><td>${i+1}</td></tr>`);
const finalHtml=`<body><h2>Women Result</h2><table><tr><th>FPl.</th><th>Name</th><th>Nation</th><th>Points</th><th>SP</th><th>FS</th></tr>${rows.join('')}</table></body>`;
test('ISU 分类链接、嵌套国旗表格和最终成绩解析',()=>{
  assert.equal(parseEventIndex(indexHtml,event).resultUrl,event.resultIndex+'CAT002RS.htm');
  assert.deepEqual(parseEventIndex(indexHtml,event).dates,{start:'2026-10-23',end:'2026-10-25'});
  const podium=parseFinalResult(finalHtml,event);
  assert.equal(podium.length,3);assert.equal(podium[0].athlete.name,names[0]);assert.equal(podium[0].score,219.74);assert.equal(podium[0].athlete.country,'JPN');
  assert.equal(parseFinalResult(finalHtml.replace('FPl.','Rank'),event).length,0);
  assert.equal(parseFinalResult(finalHtml.replace(rows[2],''),event).length,0);
  assert.equal(parseFinalResult(finalHtml.replaceAll('</td><td>1</td></tr>','</td><td></td></tr>'),event).length,0);
  assert.throws(()=>parseEventIndex(indexHtml.replace('CAT002RS.htm','https://attacker.example/CAT002RS.htm'),event));
});
test('赛事、选手跳转、图示文件与 24 个跳跃分值一致',()=>{
  assert.equal(seed.events.length,19);assert.equal(seed.athletes.length,18);
  const ids=new Set(seed.athletes.map(a=>a.id));
  for(const e of seed.events)for(const p of e.podium)assert.ok(ids.has(p.athleteId));
  const source=fs.readFileSync(path.join(__dirname,'../public/learn.js'),'utf8');
  const data=vm.runInNewContext(source+'\n({j:JUMP_KNOWLEDGE,s:SPIN_KNOWLEDGE,t:STEP_KNOWLEDGE})');
  assert.equal(data.j.length,6);assert.equal(data.s.length,10);assert.equal(data.t.length,12);
  const expected={T:[.4,1.3,4.2,9.5],S:[.4,1.3,4.3,9.7],Lo:[.5,1.7,4.9,10.5],F:[.5,1.8,5.3,11],Lz:[.6,2.1,5.9,11.5],A:[1.1,3.3,8,12.5]};
  for(const jump of data.j){assert.deepEqual(Array.from(jump.values),expected[jump.code]);assert.ok(fs.existsSync(path.join(__dirname,`../public/assets/learn/jumps-${jump.id}.svg`)));}
  for(const step of data.t)assert.ok(fs.existsSync(path.join(__dirname,`../public/assets/learn/steps-${step.id}.svg`)));
  for(const spin of data.s)assert.ok(fs.existsSync(path.join(__dirname,`../public/assets/learn/${spin.image}.png`)));
});
test('真实 MongoDB 同步缓存：新赛果写入、失败保留已验证结果',{timeout:30000},async()=>{
  const uri='mongodb://127.0.0.1:27017';const stop=await ensureLocalMongo(uri);const client=new MongoClient(uri);const name=`ice_atlas_test_${Date.now()}_${process.pid}_season`;
  let service;
  try{
    await client.connect();const db=client.db(name);
    await db.collection('season_cache').insertOne({...structuredClone(seed),_id:seed.season,events:[{...event,podium:[]}]});
    let fail=false;
    service=await createSeasonService({db,enabled:false,fetcher:async url=>{
      if(fail)throw new Error('offline');
      return {status:200,ok:true,url,text:async()=>url.endsWith('RS.htm')?finalHtml:indexHtml};
    }});
    await service.sync();const good=await service.read();assert.equal(good.events[0].podium.length,3);assert.equal(good.syncState,'ok');assert.equal(good.events[0].podium[0].score,219.74);
    fail=true;await service.sync();const cached=await service.read();assert.equal(cached.syncState,'unavailable');assert.deepEqual(cached.events[0].podium,good.events[0].podium);assert.equal(cached.syncedAt,good.syncedAt);
  }finally{
    service?.stop();assert.match(name,/^ice_atlas_test_\d+_\d+_season$/);await client.db(name).dropDatabase();await client.close();await stop();
  }
});
