const fs=require('node:fs/promises');
const {collect}=require('./collect-athlete-profiles');
const {parseCareerMedals}=require('./collect-career-medals');
const {isuFetch}=require('../src/isu-fetch');
const roster=require('../data/senior-roster.json');
(async()=>{await fs.mkdir('.tmp/podium',{recursive:true});const filename='data/athlete-profiles.json',profiles=JSON.parse(await fs.readFile(filename,'utf8'));let cursor=0;const failures=[];
 await Promise.all(Array.from({length:3},async()=>{while(cursor<roster.athletes.length){const a=roster.athletes[cursor++];if(profiles[a.id]?.photo&&profiles[a.id]?.careerMedals){console.log(a.id,'existing');continue;}try{const [id,info]=await collect(a);const url=a.bioUrl.replace('www.isuresults.com','results.isu.org').replace('/isufs','/isufs_cr_');const response=await isuFetch(url,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('Career HTTP '+response.status);const html=await response.text();if(!html.includes('Competition Results'))throw Error('Missing career table');await fs.writeFile('.tmp/podium/'+id+'-career.html',html);profiles[id]={...profiles[id],...info,careerMedals:parseCareerMedals(html,url),careerSource:url,careerVerifiedAt:'2026-11-05'};console.log(id,'saved',Boolean(info.photo));}catch(error){failures.push(a.id);console.error(a.id,error.message);}}}));
 await fs.writeFile(filename,JSON.stringify(profiles,null,2));console.log(JSON.stringify({roster:roster.athletes.length,profiles:roster.athletes.filter(a=>profiles[a.id]).length,photos:roster.athletes.filter(a=>profiles[a.id]?.photo).length,failures}));if(failures.length)process.exitCode=1;process.exit(process.exitCode||0);
})().catch(e=>{console.error(e.message);process.exit(1)});
