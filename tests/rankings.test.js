const {test}=require('node:test');const assert=require('node:assert/strict');const {MongoClient}=require('mongodb');
const {parseStandings,createRankingsService,SOURCES}=require('../src/rankings');const {ensureLocalMongo}=require('../src/local-mongo');
const seed=require('../data/rankings-seed.json');
function fixture(group='senior',count=12){return `<body><table><tr><td>ISU World Standings 2026/2027</td></tr><tr><td>${group==='junior'?'Junior Women':'Women'}</td></tr><tr><td>Standing as of 05.11.2026 09:10 UTC</td></tr>${Array.from({length:count},(_,i)=>`<tr><td rowspan="3">${i<2?1:i+1}</td><td>${i<2?1000:1000-i*10}</td><td>${i===count-1?'No bio athlete':`<a href="http://www.isuresults.com/bios/isufs${1000+i}.htm">Athlete ${i}</a>`}</td><td>JPN</td><td>2026/2027 (100%)</td><td></td><td>300</td><td>(250)</td><td></td><td></td></tr><tr><td>2025/2026 (100%)</td><td>500</td><td></td><td></td><td></td><td></td></tr><tr><td>2024/2025 (70%)</td><td>350</td><td></td><td></td><td></td><td></td></tr>`).join('')}</table></body>`;}
test('世界积分榜解析保留并列名次、括号分值、三赛季及无档案选手',()=>{
 const r=parseStandings(fixture(),'senior');assert.equal(r.rows.length,12);assert.deepEqual(r.rows.slice(0,3).map(r=>r.rank),[1,1,3]);assert.equal(r.rows[0].points,1000);assert.equal(r.rows[0].breakdown[0][3],'(250)');assert.equal(r.rows.at(-1).bioUrl,null);assert.match(r.rows[0].bioUrl,/^https:/);
 assert.throws(()=>parseStandings(fixture('junior'),'senior'));assert.throws(()=>parseStandings(fixture().replace('Standing as of','Unknown'),'senior'));assert.throws(()=>parseStandings(fixture().replace('http://www.isuresults.com/bios/','https://evil.example/bios/'),'senior'));
 assert.equal(seed.senior.rows.length,400);assert.equal(seed.junior.rows.length,245);assert.ok(seed.senior.rows.some(r=>!r.bioUrl));
});
test('MongoDB 积分榜：实际写入、同榜并发合并、失败/过旧快照保留缓存',{timeout:30000},async()=>{
 const uri='mongodb://127.0.0.1:27017',stop=await ensureLocalMongo(uri),client=new MongoClient(uri);const dbName=`ice_atlas_test_${Date.now()}_${process.pid}_rankings`;let service;
 try{await client.connect();const db=client.db(dbName);let fail=false,old=false,calls=0;
  service=await createRankingsService({db,enabled:false,fetcher:async url=>{calls++;if(fail)throw Error('offline');const group=url===SOURCES.junior?'junior':'senior';return {ok:true,url,text:async()=>fixture(group).replace('05.11.2026',old?'01.11.2026':'05.11.2026')};}});
  // 使用小型独立快照验证成功更新，不触发正式完整榜单的防截断保护。
  await db.collection('rankings_cache').updateMany({},{$set:{rows:[],officialUpdatedAt:null}});
  await Promise.all([service.sync(),service.sync()]);assert.equal(calls,2);const good=await service.read('junior');assert.equal(good.syncState,'ok');assert.equal(good.rows.length,12);
  fail=true;await service.sync();const failed=await service.read('junior');assert.equal(failed.syncState,'unavailable');assert.deepEqual(failed.rows,good.rows);assert.equal(failed.syncedAt,good.syncedAt);
  fail=false;old=true;await service.sync();const stale=await service.read('junior');assert.equal(stale.officialUpdatedAt,good.officialUpdatedAt);assert.equal(stale.syncState,'unavailable');
 }finally{service?.stop();assert.match(dbName,/^ice_atlas_test_\d+_\d+_rankings$/);await client.db(dbName).dropDatabase();await client.close();await stop();}
});
