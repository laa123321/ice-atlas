const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {mergeAthletes,profileIds}=require('../src/athletes');
const seed=require('../data/season-seed.json');

test('旧缓存合并成年名册无重复，保留组别和动态新增选手',()=>{
 const all=mergeAthletes();
 assert.equal(all.length,57);
 assert.equal(all.filter(a=>a.groups.includes('senior')).length,45);
 assert.equal(all.filter(a=>a.groups.includes('junior')).length,12);
 assert.equal(new Set(profileIds).size,57);
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
