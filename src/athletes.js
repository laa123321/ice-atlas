const seed=require('../data/season-seed.json');
const roster=require('../data/senior-roster.json');
const profiles=require('../data/athlete-profiles.json');
const aliases=require('../data/athlete-aliases.json');

// 合并新名册与旧缓存，不覆盖同步取得的新赛果，也不丢失青年组身份。
function mergeAthletes(cached=seed.athletes){
 const athletes=new Map();
 for(const athlete of [...roster.athletes,...cached]){
  const previous=athletes.get(athlete.id);
  athletes.set(athlete.id,{...previous,...athlete,groups:[...new Set([...(previous?.groups||[]),...athlete.groups])]});
 }
 return [...athletes.values()].map(athlete=>({...athlete,...(profiles[athlete.id]||{}),...(aliases[athlete.id]||{})}));
}
const profileIds=mergeAthletes().map(a=>a.id);
module.exports={mergeAthletes,profileIds};
