const seed=require('../data/season-seed.json');
const roster=require('../data/senior-roster.json');
const neutralRoster=require('../data/neutral-roster.json');
const profiles=require('../data/athlete-profiles.json');
const aliases=require('../data/athlete-aliases.json');

// 合并新名册与旧缓存，不覆盖同步取得的新赛果，也不丢失青年组身份。
function mergeAthletes(cached=seed.athletes, archives={}){
 const athletes=new Map();
 for(const athlete of [...roster.athletes,...cached,...neutralRoster.athletes]){
  const previous=athletes.get(athlete.id);
  athletes.set(athlete.id,{...previous,...athlete,groups:[...new Set([...(previous?.groups||[]),...athlete.groups])]});
 }
 return [...athletes.values()].map(athlete => {
  const profile = {...athlete, ...profiles[athlete.id], ...aliases[athlete.id]};
  const archive = archives[athlete.id];
  if (!archive) return profile;
  const { checkedAt, careerMedals, ...fields } = archive;
  Object.assign(profile, fields);
  if (careerMedals) {
   const key = medal => medal.group + '|' + medal.event.toLowerCase();
   const medals = new Map((profile.careerMedals || []).map(medal => [key(medal), medal]));
   for (const medal of careerMedals) medals.set(key(medal), medal);
   profile.careerMedals = [...medals.values()].sort((a,b) => b.year-a.year || a.rank-b.rank || a.event.localeCompare(b.event));
  }
  return profile;
 });
}
const profileIds=mergeAthletes().map(a=>a.id);
module.exports={mergeAthletes,profileIds};
