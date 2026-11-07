const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseCareerMedals}=require('../scripts/collect-career-medals');
const profiles=require('../data/athlete-profiles.json');
test('生涯奖牌解析保留早年 Ladies 与国际赛，排除国内赛及第四名',()=>{
 const row=(name,group,rank)=>`<tr><td></td><td>${name}</td><td>${group}</td><td>${rank}</td><td></td><td>JPN</td></tr>`;
 const html=`<table><tr><td>ISU Junior Grand Prix</td></tr>${row('ISU JGP Example 2016','Junior Ladies',1)}${row('ISU JGP Other 2017','Junior Ladies',4)}<tr><td>International Competition</td></tr>${row('Winter Youth Olympic Games 2024','Junior Women',1)}<tr><td>National Championships</td></tr>${row('National Championships 2024','Women',1)}</table>`;
 const result=parseCareerMedals(html,'https://results.isu.org/bios/example.htm');
 assert.equal(result.length,2);assert.equal(result[0].year,2024);assert.equal(result[1].group,'junior');
 assert.ok(profiles['mao-shimada'].careerMedals.some(m=>m.year===2022&&/Czech/.test(m.event)));
 assert.ok(profiles['anastasiia-gubanova'].careerMedals.some(m=>m.year===2016&&/Final/.test(m.event)&&m.rank===2));
 for(const profile of Object.values(profiles))for(const medal of profile.careerMedals){assert.ok([1,2,3].includes(medal.rank));assert.ok(!/^National/.test(medal.category));}
});
