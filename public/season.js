let seasonSnapshot = null;
let seasonLoadPromise = null;
let seasonLoadedAt = 0;
const COUNTRY_NAMES = {JPN:'日本',USA:'美国',CAN:'加拿大',CHN:'中国',KOR:'韩国',GEO:'格鲁吉亚',ITA:'意大利',EST:'爱沙尼亚',AUS:'澳大利亚',FRA:'法国',ISR:'以色列',SUI:'瑞士',AIN:'中立个人运动员',AIN2:'中立个人运动员',LAT:'拉脱维亚',THA:'泰国',TUR:'土耳其',SLO:'斯洛文尼亚',POL:'波兰',FIN:'芬兰',KAZ:'哈萨克斯坦',BUL:'保加利亚'};
const escapeText = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groupName = group => group === 'junior' ? '青年组' : '成年组';
const countryName = code => COUNTRY_NAMES[code] || code;
function athleteHref(id) { return `#/athlete?id=${encodeURIComponent(id)}`; }
function currentCalendarDay() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function eventStatus(event, day=currentCalendarDay()) {
  if (event.podium?.length===3) return 'finished';
  if (day < event.start) return 'upcoming';
  if (day > event.end) return 'pending';
  return 'ongoing';
}
function eventDate(event) { return `${event.start.replaceAll('-','.')} — ${event.end.replaceAll('-','.')}`; }
function seasonSource(url,label) {
  try { const parsed = new URL(url); if(parsed.protocol!=='https:') return ''; }
  catch { return ''; }
  return `<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
}
async function loadSeason(force=false) {
  if (seasonLoadPromise) return seasonLoadPromise;
  if (seasonSnapshot && !force && Date.now()-seasonLoadedAt<60000) return seasonSnapshot;
  seasonLoadPromise = Promise.all([apiRequest('/api/season'),apiRequest('/data/event-previews.json').catch(()=>({}))]).then(([data,previews])=>{seasonSnapshot={...data,events:data.events.map(event=>({...event,preview:{...previews._default,...previews[event.id]}}))};seasonLoadedAt=Date.now();return seasonSnapshot;}).finally(()=>{seasonLoadPromise=null;});
  return seasonLoadPromise;
}
function renderSeasonPage(route,raw) {
  blankCanvas.className='season-content';
  if (!seasonSnapshot) {
    blankCanvas.innerHTML='<div class="content-loading" role="status">正在读取本赛季赛事与选手资料…</div>';
    loadSeason().then(()=>{if(currentRoute===route) renderRoute();}).catch(()=>{
      if(currentRoute!==route)return;
      blankCanvas.innerHTML='<div class="content-loading"><p>暂时无法读取数据，请确认 Node.js 服务已重新启动。</p><button id="retry-season" class="small-button" type="button">重新读取</button></div>';
      document.querySelector('#retry-season').addEventListener('click',()=>renderSeasonPage(route,location.hash.slice(1)));
    });
    return;
  }
  if(route==='/events') renderEvents(raw);
  else if(route==='/athlete') { renderAthlete(raw); bindCareerFilters(); }
  else renderAthleteDirectory(route,raw);
}
function eventSeries(event) {
  return ({gp:'大奖赛',jgp:'青年大奖赛',final:'大奖赛总决赛',championship:'锦标赛'})[event.series]||groupName(event.group);
}
function selectFeaturedEvent(events, day) {
  // 赛程只有日期，结束当天仍保留本场，即使女单成绩已经公布。
  return events.filter(event => event.end >= day)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

function nextEventPreview(event, day=currentCalendarDay()) {
  if(!event)return '';
  const [year,month,startDay]=event.start.split('-'),[endYear,endMonth,endDay]=event.end.split('-');
  const sameMonth=event.start.slice(0,7)===event.end.slice(0,7),sameDay=event.start===event.end;
  const week=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',weekday:'short'}).format(new Date(`${value}T12:00:00+08:00`));
  const preview=event.preview||{},englishSeries=({gp:'ISU GRAND PRIX',jgp:'ISU JUNIOR GRAND PRIX',final:'ISU GRAND PRIX FINAL',championship:'ISU CHAMPIONSHIPS'})[event.series]||'FIGURE SKATING';
  const image=/^assets\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp)$/.test(preview.image||'')?preview.image:null;
  const inProgress=event.start<=day&&day<=event.end;
  const status={upcoming:'即将开始',ongoing:'正在进行',finished:'已结束',pending:'成绩待更新'}[inProgress?'ongoing':eventStatus(event,day)];
  const kicker=inProgress?'CURRENT EVENT / 进行中':'NEXT EVENT / 下一场';
  const dateLabel=sameMonth?`${year} 年 ${Number(month)} 月`:`${year}.${month} — ${endYear===year?'':endYear+'.'}${endMonth}`;
  const pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></svg>';
  const person='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg>';
  return `<div class="calendar-ticket-shell"><section class="calendar-next" aria-labelledby="calendar-next-title"><div class="calendar-next-copy"><p class="calendar-kicker">${kicker}</p><h2 id="calendar-next-title">${escapeText(event.name)}</h2><p class="calendar-next-english">${escapeText(preview.subtitle||englishSeries)}</p><div class="calendar-next-meta"><span>${pin}${escapeText(event.city)} · ${escapeText(countryName(event.country))}</span><span>${person}${groupName(event.group)}</span></div><a id="next-event-link" href="#/events?event=${escapeText(event.id)}">查看赛事详情 <span aria-hidden="true">→</span></a></div><div class="calendar-next-date"><span class="ticket-month">${dateLabel}</span><div class="ticket-days"><time datetime="${escapeText(event.start)}"><strong>${startDay}</strong><small>(${week(event.start)})</small></time>${sameDay?'':`<span class="ticket-date-dash" aria-hidden="true">—</span><time datetime="${escapeText(event.end)}"><strong>${endDay}</strong><small>(${week(event.end)})</small></time>`}</div><span class="ticket-status">${status}</span></div><div class="calendar-next-visual${image?' has-preview-image':''}">${image?`<img src="${escapeText(image)}" alt="${escapeText(preview.imageAlt||event.name+'赛事主视觉')}" width="1289" height="860">`:`<div class="ticket-visual-placeholder" aria-hidden="true"></div>`}</div></section></div>`;
}
function eventMonths(events) {
  if(!events.length)return '<div class="content-loading">没有符合筛选条件的赛事。</div>';
  const months=new Map();
  for(const event of events){const key=event.start.slice(0,7);if(!months.has(key))months.set(key,[]);months.get(key).push(event);}
  return [...months].map(([key,items])=>{const [year,month]=key.split('-');return `<section class="calendar-month" aria-labelledby="month-${key}"><div class="calendar-month-heading"><h3 id="month-${key}"><strong>${Number(month)} 月</strong><span>${year}</span></h3><span>${items.length} 场赛事</span></div><div class="calendar-month-events">${items.map(eventCard).join('')}</div></section>`;}).join('');
}
function renderEvents(raw) {
  const params=new URLSearchParams(raw.split('?')[1]||'');
  const group=['senior','junior'].includes(params.get('group'))?params.get('group'):'all';
  const filter=['upcoming','finished','ongoing'].includes(params.get('status'))?params.get('status'):'all';
  const day=currentCalendarDay();
  const events=seasonSnapshot.events.filter(e=>(group==='all'||e.group===group)&&(filter==='all'||(filter==='finished'?['finished','pending'].includes(eventStatus(e,day)):eventStatus(e,day)===filter))).sort((a,b)=>a.start.localeCompare(b.start)||a.group.localeCompare(b.group));
  const next=selectFeaturedEvent(seasonSnapshot.events,day);
  const updated=seasonSnapshot.syncedAt?new Date(seasonSnapshot.syncedAt).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false}):`${seasonSnapshot.seedVerifiedAt} 人工核对快照`;
  blankCanvas.innerHTML=`${nextEventPreview(next,day)}<div class="calendar-list-heading"><div><p class="calendar-kicker">${seasonSnapshot.season} / SEASON CALENDAR</p><h2>赛事日历</h2></div><span>${seasonSnapshot.events.length} 场已收录赛事</span></div><div class="season-controls"><div class="segmented-control" aria-label="赛事组别">${[['all','全部组别'],['senior','成年组'],['junior','青年组']].map(([v,n])=>`<a href="#/events?group=${v}&status=${filter}" ${group===v?'aria-current="page"':''}>${n}</a>`).join('')}</div><label class="select-label">赛事状态<select id="event-status"><option value="all">全部状态</option><option value="upcoming">未开始</option><option value="ongoing">进行中</option><option value="finished">已结束</option></select></label><button id="refresh-season" class="small-button" type="button">刷新页面数据 ↻</button></div><div class="sync-line"><span>最近同步：${escapeText(updated)}（UTC+8）${seasonSnapshot.syncing?' · 正在同步':''}</span></div><div class="event-list">${eventMonths(events)}</div><p class="learn-smallprint">日期状态按 UTC+8 更新；赛事日期含官方成绩页所列活动日。未开放成绩页的赛程采用 ISU 已公布安排，后续以官方公告为准。点击前三名姓名可查看选手简介。</p>`;
  const select=document.querySelector('#event-status');select.value=filter;select.addEventListener('change',()=>{location.hash=`/events?group=${group}&status=${select.value}`;});
  document.querySelector('#refresh-season').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='正在读取…';
    try{await loadSeason(true);if(currentRoute==='/events')renderEvents(location.hash.slice(1));}
    catch{button.disabled=false;button.textContent='重新读取';showNotice('暂时无法读取，已保留当前数据。',true);}
  });
  document.querySelector('#next-event-link')?.addEventListener('click',event=>{
    event.preventDefault();
    const target=document.getElementById(`event-${next.id}`);
    if(target)target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    else location.hash=`/events?event=${encodeURIComponent(next.id)}`;
  });
  const selected=params.get('event');
  if(selected&&events.some(e=>e.id===selected))requestAnimationFrame(()=>document.getElementById(`event-${selected}`)?.scrollIntoView({block:'start'}));
}
function eventCard(event) {
  const status=eventStatus(event);
  const hasPhoto=status==='finished'&&/^assets\/events\/[a-z0-9-]+\.(jpg|png|webp)$/.test(event.photo||'');
  const labels={finished:'已结束',upcoming:'未开始',ongoing:'进行中',pending:'已结束 · 成绩待更新'};
  return `<article class="event-card${hasPhoto?' has-podium-photo':''}" id="event-${escapeText(event.id)}">${hasPhoto?`<img class="event-backdrop" src="${escapeText(event.photo)}" alt="" loading="lazy" width="1400" height="900">`:''}<div class="event-heading"><div><p class="event-date">${eventDate(event)}</p><h3>${escapeText(event.name)}</h3><p class="event-location">${escapeText(event.city)} · ${escapeText(countryName(event.country))}<span class="group-badge">${groupName(event.group)}</span></p></div><span class="event-state state-${status}">${labels[status]}</span></div>${event.podium?.length===3?`<ol class="event-podium">${event.podium.map(result=>{const athlete=seasonSnapshot.athletes.find(a=>a.id===result.athleteId);return `<li><span class="medal medal-${result.place}">${result.place}</span><div><a href="${athleteHref(result.athleteId)}">${escapeText(athlete?.name||result.athleteId)} <span aria-hidden="true">↗</span></a><p>${escapeText(countryName(athlete?.country||''))}${result.score!=null?` · ${Number(result.score).toFixed(2)} 分`:''}</p></div></li>`;}).join('')}</ol>`:`<div class="event-awaiting">${status==='upcoming'?'比赛尚未开始，前三名将在官方最终成绩公布并同步后显示。':status==='ongoing'?'比赛进行中，待自由滑结束及官方总成绩公布后更新前三名。':'暂未读取到完整的官方最终成绩，保留待更新状态。'}</div>`}<div class="event-source">${event.podium?.length?seasonSource(event.source,'ISU 官方成绩'):''}</div></article>`;
}
function renderAthleteDirectory(route,raw) {
  const params=new URLSearchParams(raw.split('?')[1]||'');
  const group=params.get('group')==='junior'?'junior':'senior';
  const athletes=seasonSnapshot.athletes.filter(a=>a.groups.includes(group));
  const countries=[...new Set(athletes.map(a=>a.country))].sort((a,b)=>countryName(a).localeCompare(countryName(b),'zh-CN'));
  const tabs=`<div class="ranking-tabs athlete-tabs" role="tablist" aria-label="选手组别">${[['senior','成年组','SENIOR WOMEN'],['junior','青年组','JUNIOR WOMEN']].map(([id,label,en])=>`<a id="athlete-tab-${id}" role="tab" href="#/skaters?group=${id}" aria-selected="${id===group}" aria-controls="athlete-panel" tabindex="${id===group?0:-1}">${label}<span>${en}</span></a>`).join('')}</div>`;
  blankCanvas.innerHTML=`<p class="directory-description">仅收录获奖过的选手。</p><div class="directory-toolbar">${tabs}<div class="athlete-controls"><label class="search-label"><svg class="search-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input aria-label="查找选手" id="athlete-search" type="search" placeholder="输入姓名、花名或国家 / 地区" maxlength="80"></label><label class="select-label">国家 / 地区<select id="athlete-country"><option value="all">全部</option>${countries.map(c=>`<option value="${escapeText(c)}">${escapeText(countryName(c))}</option>`).join('')}</select></label><span id="athlete-count" role="status"></span></div></div><div id="athlete-panel" role="tabpanel" aria-labelledby="athlete-tab-${group}"><div id="athlete-grid" class="athlete-grid"></div></div>`;
  const input=document.querySelector('#athlete-search');input.value=params.get('q')||'';
  const select=document.querySelector('#athlete-country');select.value=countries.includes(params.get('country'))?params.get('country'):'all';
  function update() {
    const q=input.value.trim().toLocaleLowerCase();
    const filtered=athletes.filter(a=>(select.value==='all'||a.country===select.value)&&`${a.name} ${a.nickname||""} ${countryName(a.country)} ${a.country}`.toLocaleLowerCase().includes(q));
    document.querySelector('#athlete-count').textContent=`${filtered.length} 位选手`;
    document.querySelector('#athlete-grid').innerHTML=filtered.length?filtered.map(athlete=>{
      return `<a class="athlete-card" href="${athleteHref(athlete.id)}">${athlete.photo?`<div class="athlete-card-photo"><img src="${escapeText(athlete.photo)}" alt="${escapeText(athlete.name)} 的 ISU 官方档案照片" loading="lazy" width="400" height="300"></div>`:`<div class="athlete-card-top"><span class="athlete-monogram" aria-hidden="true">${escapeText(athlete.name.split(' ').map(p=>p[0]).slice(0,2).join(''))}</span><span>${escapeText(athlete.country)}</span></div>`}<h3>${escapeText(athlete.name)}</h3><p class="athlete-card-country">${escapeText(countryName(athlete.country))}<span>${escapeText(athlete.country)}</span></p><p class="athlete-card-group">${groupName(group)} · 女子单人滑</p></a>`;
    }).join(''):'<p class="empty-search">没有找到匹配选手，试试英文姓名或调整国家筛选。</p>';
    const query=new URLSearchParams({group});if(q)query.set('q',input.value.trim());if(select.value!=='all')query.set('country',select.value);
    history.replaceState(null,'',`#${route}${query.size?'?'+query:''}`);
  }
  blankCanvas.querySelectorAll('[role="tab"]').forEach(tab=>tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const target=event.key==='Home'?'senior':event.key==='End'?'junior':group==='junior'?'senior':'junior';
    location.hash=`/skaters?group=${target}`;
    requestAnimationFrame(()=>document.querySelector('#athlete-tab-'+target)?.focus());
  }));
  input.addEventListener('input',update);select.addEventListener('change',update);update();
}
function renderCareerMedals(athlete) {
  const medals=athlete.careerMedals||[];
  if(!medals.length)return "";
  const labels={1:'金牌',2:'银牌',3:'铜牌'};
  return `<section class="career-archive"><div class="values-heading"><h3>历年国际赛事奖牌记录</h3><span>${medals.length} 枚 · 成年组与青年组</span></div><p class="career-scope">按 ISU 生涯成绩档案归档：冬奥会、世锦赛、欧锦赛、四大洲、世青赛、大奖赛及总决赛、挑战者系列赛和其他国际赛事。仅列总成绩前三名，不计国内赛和单项小奖牌；赛事名称保留官方原文。</p>${medals.length?`<div class="profile-results-table"><table class="career-medals-table"><thead><tr><th scope="col">年份</th><th scope="col">赛事</th><th scope="col">组别</th><th scope="col">奖牌</th><th scope="col">代表</th></tr></thead><tbody>${medals.map(m=>`<tr><td>${m.year}</td><th scope="row">${seasonSource(m.source,escapeText(m.event))}</th><td>${groupName(m.group)}</td><td><span class="career-medal rank-${m.rank}">${labels[m.rank]} · 第 ${m.rank} 名</span></td><td>${escapeText(countryName(m.country||athlete.country))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="career-scope">当前 ISU 生涯档案暂未列出符合条件的国际赛事奖牌。</p>'}<p class="learn-smallprint">年份取赛事官方名称中的年份；跨年总决赛以名称起始年归档。${seasonSource(athlete.careerSource,'查看 ISU 生涯成绩档案')}。此表为档案快照；本赛季已收录赛事的实时成绩见下表。</p></section>`;
}
function bindCareerFilters() {
 const archive=document.querySelector('.career-archive');if(!archive)return;
 const table=archive.querySelector('table');if(!table)return;
 const rows=[...table.tBodies[0].rows];const years=[...new Set(rows.map(r=>r.cells[0].textContent))];
 const controls=document.createElement('label');controls.className='select-label career-controls';controls.textContent='按年份查看';
 const select=document.createElement('select');select.setAttribute('aria-label','奖牌记录年份');
 for(const [value,label] of [['all','全部年份'],...years.map(y=>[y,y+' 年'])]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 controls.append(select);archive.querySelector('.career-scope').after(controls);
 select.addEventListener('change',()=>{rows.forEach(row=>{row.hidden=select.value!=='all'&&row.cells[0].textContent!==select.value;});});
}
function renderAthlete(raw) {
  const id=new URLSearchParams(raw.split('?')[1]||'').get('id');
  const athlete=seasonSnapshot.athletes.find(a=>a.id===id);
  if(!athlete){blankCanvas.innerHTML='<div class="content-loading"><p>暂未收录这位选手。</p><a href="#/events">返回赛事页面 ↗</a></div>';return;}
  const group=athlete.groups.includes('senior')?'senior':'junior';
  document.querySelector('#section-title').textContent='选手简介';document.querySelector('#breadcrumb-label').textContent='选手简介';
  document.querySelector('.nav-inner>a[href="#/skaters"]').setAttribute('aria-current','page');
  document.title=`${athlete.name} · 选手简介 · 冰上图鉴`;
  const records=seasonSnapshot.events.flatMap(event=>{const result=event.podium?.find(p=>p.athleteId===id);return result?[{event,result}]:[];}).sort((a,b)=>b.event.start.localeCompare(a.event.start));
  const birthday=athlete.birthDate?athlete.birthDate.replace(/(\d{2})\.(\d{2})\.(\d{4})/,'$3年$2月$1日'):'';
  const identity=athlete.country.startsWith('AIN')?'以中立个人运动员身份参赛的女子单人滑选手':`${countryName(athlete.country)}的女子单人滑选手`;
  const introduction=`${athlete.name} 是${identity}${birthday?'，出生于'+birthday:''}。${athlete.startSkating&&/^\d{4}$/.test(athlete.startSkating)?athlete.startSkating+'年开始滑冰。':''}${athlete.highlights?.[0]?`其代表成绩包括 ${athlete.highlights[0].season} 赛季${athlete.highlights[0].event}第 ${athlete.highlights[0].rank} 名。`:''}`;
  blankCanvas.innerHTML=`<a class="profile-back" href="#/skaters?group=${group}">← 返回${groupName(group)}选手图鉴</a><div class="athlete-profile"><figure class="profile-portrait">${athlete.photo?`<img src="${escapeText(athlete.photo)}" alt="${escapeText(athlete.name)} 的 ISU 官方档案照片" width="500" height="650">`:`<div class="profile-symbol" aria-hidden="true">${escapeText(athlete.name.split(' ').map(p=>p[0]).slice(0,2).join(''))}</div>`}${athlete.photoSource?`<figcaption>${seasonSource(athlete.photoSource,'照片来源：ISU 官方档案')}</figcaption>`:''}</figure><div><p class="eyebrow">${seasonSnapshot.season} / WOMEN'S SINGLE SKATING</p><h2>${escapeText(athlete.name)}</h2><p class="profile-meta">${escapeText(countryName(athlete.country))} · ${athlete.groups.map(groupName).join(' / ')} · 女子单人滑</p><p class="profile-description">${escapeText(introduction)}</p><dl class="profile-facts">${athlete.nickname?`<div><dt>冰迷花名</dt><dd>${escapeText(athlete.nickname)}</dd></div>`:""}${athlete.birthDate?`<div><dt>出生日期</dt><dd>${escapeText(athlete.birthDate)}</dd></div>`:''}${athlete.startSkating?`<div><dt>开始滑冰</dt><dd>${escapeText(athlete.startSkating)}</dd></div>`:''}${athlete.club?`<div><dt>俱乐部</dt><dd>${escapeText(athlete.club)}</dd></div>`:''}</dl>${athlete.personalBest?`<div class="profile-best"><span>ISU 档案个人最佳总分</span><strong>${Number(athlete.personalBest.score).toFixed(2)}</strong><small>${escapeText(athlete.personalBest.event)} · ${escapeText(athlete.personalBest.date)}</small></div>`:''}${seasonSource(athlete.profileUrl||athlete.bioUrl,'ISU 官方个人档案')}</div></div>${athlete.highlights?.length?`<section class="career-highlights"><div class="values-heading"><h3>代表成绩</h3><span>不限于本赛季</span></div><div class="career-grid">${athlete.highlights.map(highlight=>`<article><span>${escapeText(highlight.season)}</span><h4>${escapeText(highlight.event)}</h4><p>第 <strong>${highlight.rank}</strong> 名</p>${seasonSource(highlight.source,'ISU 档案依据')}</article>`).join('')}</div></section>`:''}${renderCareerMedals(athlete)}${records.length?`<section class="profile-results"><div class="values-heading"><h3>本赛季已收录成绩</h3><a href="#/events">查看全部赛事 ↗</a></div><div class="profile-results-table"><table><thead><tr><th scope="col">日期</th><th scope="col">赛事</th><th scope="col">名次</th><th scope="col">总分</th><th scope="col">来源</th></tr></thead><tbody>${records.map(({event,result})=>`<tr><td>${event.start}</td><th scope="row"><a href="#/events?event=${escapeText(event.id)}">${escapeText(event.name)} ↗</a></th><td>第 ${result.place} 名</td><td>${result.score!=null?Number(result.score).toFixed(2):'尚未读取'}</td><td>${seasonSource(event.source,'官方成绩')}</td></tr>`).join('')}</tbody></table></div><p class="learn-smallprint">历史代表成绩与基本资料依据 ISU 官方档案。本季表格仅列已收录赛事的领奖台，组别按本季参赛记录归类。</p></section>`:""}`;
}
setInterval(()=>{
  if(document.hidden||!['/events','/skaters','/athlete'].includes(currentRoute))return;
  loadSeason(true).then(()=>{
    if(currentRoute==='/events'){
      const y=window.scrollY;renderEvents(location.hash.slice(1));window.scrollTo(0,y);
    }
  }).catch(()=>{});
},60000);
