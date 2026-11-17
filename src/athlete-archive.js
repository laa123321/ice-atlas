const cheerio=require('cheerio');
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

function parseBio(html) {
 const $=cheerio.load(html), fields={};
 $('tr').each((_, row)=>{
  const [label,value,date,event]=$(row).children('td').toArray().map(cell=>clean($(cell).text()));
  if(label==='Personal Best Total Score' && /^\d+\.\d{2}$/.test(value) && Number(value)>0 && /^\d{2}\.\d{2}\.\d{4}$/.test(date) && event){
   fields.personalBest={score:Number(value),date,event};
  }
  if(label==='Date of birth:' && /^\d{2}\.\d{2}\.\d{4}$/.test(value))fields.birthDate=value;
  if(label==='Start sk. / Club:' && value){
   const match=value.match(/^(\d{4})\s*\/\s*(.*)$/);
   if(match){
    fields.startSkating=match[1];
    if(match[2])fields.club=match[2];
   }
  }
 });
 return fields;
}
module.exports={parseCareerMedals,parseBio};
