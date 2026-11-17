// 从公开 ISU 档案补充照片、基础资料与历史代表成绩，原始 HTML 只留临时目录。
const fs=require('node:fs/promises');
const path=require('node:path');
const cheerio=require('cheerio');
const seed=require('../data/season-seed.json');
const {isuFetch}=require('../src/isu-fetch');
const root=path.join(__dirname,'..');
const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
const eventNames={'Olympic Games':'冬奥会','World Championships':'世界锦标赛','World Championship':'世界锦标赛','European Championships':'欧洲锦标赛','European Championship':'欧洲锦标赛','Four Continents Championships':'四大洲锦标赛','Four Continents':'四大洲锦标赛','World Junior Championships':'世界青年锦标赛','World Juniors':'世界青年锦标赛'};
async function get(url){const response=await isuFetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('HTTP '+response.status);return response;}
async function collect(athlete,{cacheHtml=true,verifiedAt='2026-11-04'}={}){
  const profileUrl='https://www.isu-skating.com/en/figure-skating/skaters/'+athlete.id+'/';
  const bioUrl=athlete.bioUrl.replace('www.isuresults.com','results.isu.org').replace('isuresults.com','results.isu.org');
  const oldHtml=await (await get(bioUrl)).text();
  if(cacheHtml)await fs.writeFile(path.join(root,'.tmp',athlete.id+'-bio.html'),oldHtml);
  const old=cheerio.load(oldHtml);const oldText=clean(old('body').text());
  let profileHtml='';try{profileHtml=await(await get(profileUrl)).text();}catch{}
  const $=cheerio.load(profileHtml);
  if(profileHtml&&cacheHtml)await fs.writeFile(path.join(root,'.tmp',athlete.id+'-profile.html'),profileHtml);
  function field(label){const li=$('li').toArray().find(e=>clean($(e).text()).startsWith(label)&&clean($(e).text()).length<200);return li?clean($(li).text()).slice(label.length).trim():'';}
  const birthday=field('Date of birth')||oldText.match(/Date of birth:\s*(\d{2}\.\d{2}\.\d{4})/)?.[1]||'';
  const skating=field('Start skating')||oldText.match(/Start sk\. \/ Club:\s*(\d{4})/)?.[1]||'';
  const info={profileUrl:profileHtml?profileUrl:bioUrl,birthDate:birthday,startSkating:skating,club:field('Club')||oldText.match(/Start sk\. \/ Club:\s*\d{4}\s*\/\s*(.+?)(?=Internet \/ Social Media contact:)/)?.[1]?.trim()||'',profileVerifiedAt:verifiedAt,highlights:[]};
  const image=$('img').toArray().find(img=>clean($(img).attr('alt')).toLocaleLowerCase()===athlete.name.toLocaleLowerCase());
  if(image){
    const src=new URL($(image).attr('src'),profileUrl).href;
    const host=new URL(src).hostname;
    if(host.endsWith('azurefd.net')||host==='isudam.blob.core.windows.net'){
      const response=await get(src);const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>5000000)throw new Error('Unexpected photo size');
      const type=response.headers.get('content-type')||'';const extension=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
      info.photo=`assets/athletes/${athlete.id}.${extension}`;info.photoSource=profileUrl;info.photoCredit='ISU 官方选手档案';
      await fs.writeFile(path.join(root,'public',info.photo),bytes);
    }
  }
  for(const table of $('table').toArray()){
    const rows=$(table).find('tr').toArray().map(row=>$(row).children('th,td').toArray().map(cell=>clean($(cell).text())));
    if(rows[0]?.[0]==='Season'){
      const seasons=rows[0].slice(1);
      for(const row of rows.slice(1)){
        const title=eventNames[row[0]];if(!title)continue;
        row.slice(1).forEach((rank,i)=>{if(/^[123]$/.test(rank))info.highlights.push({season:seasons[i],event:title,rank:Number(rank),source:profileUrl,priority:/冬奥|世界锦标/.test(title)?100:/欧洲|四大洲/.test(title)?90:80});});
      }
    }
    for(const row of rows){
      if(row[0]==='Personal Best Total Score'&&Number.isFinite(Number(row.at(-1))))info.personalBest={event:row[1],date:row[2],score:Number(row.at(-1))};
    }
  }
  // 无成年/青年锦标赛奖牌时，补充官方旧版档案中的大奖赛等前三名。
  for(const row of old('tr').toArray()){
    const cells=old(row).children('td').toArray().map(cell=>clean(old(cell).text())).filter(Boolean);
    if(!info.personalBest&&cells[0]==='Personal Best Total Score'&&Number(cells[1])>0){
      info.personalBest={score:Number(cells[1]),date:cells[2],event:cells[3]};
    }
    for(let i=0;i<cells.length-2;i++){
      if(/^ISU\s+(?:JGP|GP|CS)\s/.test(cells[i])&&/^20\d{2}$/.test(cells[i+1])&&/^[123]\.?$/.test(cells[i+2]))info.highlights.push({season:cells[i+1],event:cells[i],rank:parseInt(cells[i+2]),source:bioUrl,priority:cells[i].startsWith('ISU GP ')?70:cells[i].startsWith('ISU JGP ')?60:50});
    }
  }
  info.highlights.sort((a,b)=>b.priority-a.priority||a.rank-b.rank||b.season.localeCompare(a.season));
  const unique=new Set();info.highlights=info.highlights.filter(h=>{const k=h.event+h.season;if(unique.has(k))return false;unique.add(k);return true;}).slice(0,5).map(({priority,...h})=>h);
  console.log(athlete.id+': '+(info.photo?'photo saved':'photo not found')+', '+info.highlights.length+' historical highlights');
  return [athlete.id,info];
}
if(require.main===module)(async()=>{
  await fs.mkdir(path.join(root,'public/assets/athletes'),{recursive:true});await fs.mkdir(path.join(root,'.tmp'),{recursive:true});
  let cursor=0;const output=JSON.parse(await fs.readFile(path.join(root,'data/athlete-profiles.json'),'utf8').catch(()=>'{}'));const failures=[];
  await Promise.all(Array.from({length:3},async()=>{while(cursor<seed.athletes.length){const athlete=seed.athletes[cursor++];try{const[id,info]=await collect(athlete);output[id]={...output[id],...info};}catch(error){failures.push(athlete.id);console.error(athlete.id+': '+error.message);}}}));
  await fs.writeFile(path.join(root,'data/athlete-profiles.json'),JSON.stringify(output,null,2));
  console.log(JSON.stringify({profiles:Object.keys(output).length,photos:Object.values(output).filter(a=>a.photo).length,failures}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={collect};
