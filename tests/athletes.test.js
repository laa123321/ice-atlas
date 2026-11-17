const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {mergeAthletes,profileIds}=require('../src/athletes');
const seed=require('../data/season-seed.json');

test('旧缓存合并成年名册无重复，保留组别和动态新增选手',()=>{
 const all=mergeAthletes();
 assert.equal(all.length,70);
 assert.equal(all.filter(a=>a.groups.includes('senior')).length,52);
 assert.equal(all.filter(a=>a.groups.includes('junior')).length,18);
 assert.equal(new Set(profileIds).size,all.length);
 assert.deepEqual(mergeAthletes(all),all);
 const cached=[...seed.athletes,{id:'mao-shimada',name:'Mao SHIMADA',country:'JPN',groups:['junior']},{id:'new-podium-athlete',name:'New Athlete',country:'CAN',groups:['junior']}];
 const merged=mergeAthletes(cached);
 assert.deepEqual(merged.find(a=>a.id==='mao-shimada').groups,['senior','junior']);
 assert.ok(merged.some(a=>a.id==='new-podium-athlete'));
 for(const a of all){
  assert.ok(fs.existsSync(path.join(__dirname,'../public',a.photo)),a.id);
  assert.ok(a.careerMedals.every(m=>[1,2,3].includes(m.rank)),a.id);
 }
});

test('中立女单沿用 ISU 本赛季组别，特鲁索娃保留历史参赛代表和奖牌',()=>{
 const previous={id:'alexandra-ignatova',name:'Alexandra IGNATOVA',country:'RUS',groups:['senior']};
 const athletes=mergeAthletes([...seed.athletes,previous]);
 const neutral=athletes.filter(a=>/^AIN[12]?$/.test(a.country));
 assert.equal(neutral.filter(a=>a.groups.includes('senior')).length,8);
 assert.equal(neutral.filter(a=>a.groups.includes('junior')).length,7);
 const ignatova=athletes.find(a=>a.id===previous.id);
 assert.equal(ignatova.country,'AIN2');
 assert.deepEqual(ignatova.groups,['senior']);
 assert.equal(ignatova.personalBest.score,251.73);
 assert.equal(ignatova.careerMedals.length,21);
 assert.ok(ignatova.careerMedals.some(m=>m.event.includes('Olympic Winter Games 2022')&&m.rank===2&&m.country==='ROC'));
 assert.ok(ignatova.careerMedals.some(m=>m.event==='ISU JGP Brisbane 2017'&&m.rank===1&&m.country==='RUS'));
 assert.ok(ignatova.careerMedals.some(m=>m.event==='ISU GP Cup of China 2026'&&m.rank===2&&m.country==='AIN2'));
});

test('花名仅配置给已核实的选手，无花名时不产生占位值',()=>{
 const all=mergeAthletes();
 assert.equal(all.find(a=>a.id==='sofiia-dzepka').nickname,'摩卡');
 assert.equal(all.find(a=>a.id==='mao-shimada').nickname,'小小猫');
 assert.equal(all.find(a=>a.id==='alysa-liu').nickname,undefined);
 for(const a of all.filter(a=>a.nickname)){
  assert.ok(a.nickname.trim());
  assert.ok(a.nicknameSources.length);
 }
});
