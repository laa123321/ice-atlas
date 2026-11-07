const cheerio=require('cheerio');
const seed=require('../data/rankings-seed.json');
const {isuFetch}=require('./isu-fetch');
const {profileIds}=require('./athletes');
const SOURCES={senior:'https://results.isu.org/ws/ws/wswomen.htm',junior:'https://results.isu.org/ws/ws/wsjuniorwomen.htm'};
const INTERVAL=60*60*1000;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function parseStandings(html,group){
 if(!SOURCES[group])throw Error('Invalid standings group');
 const $=cheerio.load(html),body=clean($('body').text());
 const season=body.match(/ISU World Standings\s+(20\d{2}\/20\d{2})/)?.[1];
 const stamp=body.match(/Standing as of\s+(\d{2})\.(\d{2})\.(20\d{2})\s+(\d{2}):(\d{2})\s+UTC/);
 const category=$('tr').toArray().map(r=>clean($(r).text())).find(t=>t==='Women'||t==='Junior Women');
 if(!season||!stamp||category!==(group==='junior'?'Junior Women':'Women'))throw Error('Unexpected ISU standings page');
 const officialUpdatedAt=`${stamp[3]}-${stamp[2]}-${stamp[1]}T${stamp[4]}:${stamp[5]}:00.000Z`;
 if(!Number.isFinite(Date.parse(officialUpdatedAt)))throw Error('Invalid standings date');
 const rows=[];let current;
 $('tr').each((_,tr)=>{
  const cells=$(tr).children('td,th');const values=cells.toArray().map(td=>clean($(td).text()));
  const link=cells.eq(2).find('a').first();
  if(values.length>=10&&/^\d+$/.test(values[0])&&/^\d+$/.test(values[1])){
   let bioUrl=null;
   if(link.length){const url=new URL(link.attr('href'),SOURCES[group]);
    if(!['www.isuresults.com','isuresults.com','results.isu.org'].includes(url.hostname)||!/^\/bios\/isufs\d+\.htm$/.test(url.pathname))throw Error('Unexpected athlete address');
    url.protocol='https:';bioUrl=url.href;}
   current={rank:Number(values[0]),points:Number(values[1]),name:values[2],country:values[3],bioUrl,athleteId:values[2].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),breakdown:[]};
   if(!current.name||! /^[A-Z0-9]{2,4}$/.test(current.country))throw Error('Invalid athlete row');
   rows.push(current);current.breakdown.push(values.slice(4));
  }else if(current&&/^20\d{2}\/20\d{2}\s*\(/.test(values[0]))current.breakdown.push(values);
 });
 if(!rows.length||rows[0].rank!==1||rows.some((r,i)=>r.breakdown.length!==3||(i&&r.rank<rows[i-1].rank)||(i&&r.points>rows[i-1].points))||new Set(rows.map(r=>r.bioUrl||r.name+'|'+r.country)).size!==rows.length)throw Error('Incomplete or invalid standings');
 return {group,source:SOURCES[group],season,officialUpdatedAt,rows};
}
async function createRankingsService({db,enabled=true,fetcher=isuFetch}){
 const collection=db.collection('rankings_cache');
 for(const group of Object.keys(SOURCES))await collection.updateOne({_id:group},{$setOnInsert:{...(seed[group]||{group,source:SOURCES[group],rows:[]}),syncState:'cached'}},{upsert:true});
 let stopped=false,inFlight=null,timer;const controllers=new Set();
 async function read(group){
  if(!SOURCES[group])throw Error('Invalid standings group');
  const row=await collection.findOne({_id:group},{projection:{_id:0}});
  return {...row,profileIds,syncing:Boolean(inFlight),nextCheckAt:row.lastAttemptAt?new Date(Date.parse(row.lastAttemptAt)+INTERVAL).toISOString():null};
 }
 async function update(group){
  const controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetcher(SOURCES[group],{signal:controller.signal,redirect:'follow',headers:{'User-Agent':'IceAtlas-CourseProject/1.0',Accept:'text/html'}});
   if(!response.ok)throw Error('Official page unavailable');
   if(response.url&&response.url!==SOURCES[group])throw Error('Unexpected redirect');
   const html=await response.text();if(html.length>4000000)throw Error('Unexpected standings size');
   const snapshot=parseStandings(html,group);if(snapshot.rows.length<10)throw Error('Unexpected standings length');
   const previous=await read(group);
   if(previous.officialUpdatedAt&&Date.parse(snapshot.officialUpdatedAt)<Date.parse(previous.officialUpdatedAt))throw Error('Older official snapshot');
   if(previous.season===snapshot.season&&previous.rows.length&&snapshot.rows.length<previous.rows.length*.6)throw Error('Unexpected truncated standings');
   if(!stopped)await collection.updateOne({_id:group},{$set:{...snapshot,syncedAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),syncState:'ok'}});
  }catch{
   if(!stopped)await collection.updateOne({_id:group},{$set:{lastAttemptAt:new Date().toISOString(),syncState:'unavailable'}});
  }finally{clearTimeout(timeout);controllers.delete(controller);}
 }
 function sync(){if(stopped)return Promise.resolve();if(inFlight)return inFlight;inFlight=Promise.all(Object.keys(SOURCES).map(update)).finally(()=>{inFlight=null;});return inFlight;}
 if(enabled){const run=async()=>{await sync().catch(()=>console.error('积分榜同步失败，保留已有缓存。'));if(!stopped){timer=setTimeout(run,INTERVAL);timer.unref();}};timer=setTimeout(run,200);timer.unref();}
 return {read,sync,stop(){stopped=true;clearTimeout(timer);for(const c of controllers)c.abort();}};
}
module.exports={parseStandings,createRankingsService,SOURCES};
