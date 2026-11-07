// ISU Competition Results 生涯档案：仅保留成年/青年国际赛事最终总名次前三。
const fs=require('node:fs/promises');
const path=require('node:path');
const cheerio=require('cheerio');
const {isuFetch}=require('../src/isu-fetch');
const {mergeAthletes}=require('../src/athletes');
const seed={athletes:mergeAthletes()};
const root=path.join(__dirname,'..');
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function parseCareerMedals(html,source){
 const $=cheerio.load(html);const records=[];let category='';
 $('tr').each((_,row)=>{
  const cells=$(row).children('td,th').toArray().map(el=>clean($(el).text()));
  const nonempty=cells.filter(Boolean);
  if(nonempty.length===1){category=nonempty[0];return;}
  if(cells.length<4||/^National/i.test(category))return;
  const event=cells[1],discipline=cells[2],place=cells[3];
  if(!event||!/^([123])$/.test(place)||!/^(?:Junior\s+)?(?:Women|Ladies)(?:\s+\d+)?$/.test(discipline))return;
  if(!/Olympic|World|European|Continents|Grand Prix|Challenger|International Competition/i.test(category))return;
  const year=Number(event.match(/20\d{2}/)?.[0]);if(!year)return;
  const group=/Junior/.test(discipline)?'junior':'senior';
  records.push({year,event,group,rank:Number(place),category,country:cells[5]||'',source});
 });
 const seen=new Set();return records.filter(r=>{const key=r.event+'|'+r.group;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.year-a.year||a.rank-b.rank||a.event.localeCompare(b.event));
}
async function main(){
 const filename=path.join(root,'data/athlete-profiles.json');const profiles=JSON.parse(await fs.readFile(filename,'utf8'));const failures=[];let cursor=0;
 await fs.mkdir(path.join(root,'.tmp/podium'),{recursive:true});
 await Promise.all(Array.from({length:3},async()=>{while(cursor<seed.athletes.length){const athlete=seed.athletes[cursor++];const source=athlete.bioUrl.replace('www.isuresults.com','results.isu.org').replace('/isufs','/isufs_cr_');try{
  let html;const cached=path.join(root,'.tmp/podium',athlete.id+'-career.html');
  if(process.argv.includes('--cached'))html=await fs.readFile(cached,'utf8');
  else{const response=await isuFetch(source,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('HTTP '+response.status);html=await response.text();await fs.writeFile(cached,html);}
  if(!/Competition Results/.test(html))throw Error('Not an ISU career archive');
  const medals=parseCareerMedals(html,source);
  profiles[athlete.id]={...profiles[athlete.id],careerMedals:medals,careerSource:source,careerVerifiedAt:new Date().toISOString().slice(0,10)};
  console.log(`${athlete.id}: ${medals.length} medals (${medals.filter(r=>r.year<2026).length} before 2026)`);
 }catch(error){failures.push(athlete.id);console.error(athlete.id+': '+error.message);}}}));
 await fs.writeFile(filename,JSON.stringify(profiles,null,2));
 if(failures.length)process.exitCode=1;
 console.log(JSON.stringify({athletes:Object.keys(profiles).length,medals:Object.values(profiles).reduce((n,p)=>n+(p.careerMedals?.length||0),0),failures}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseCareerMedals};
