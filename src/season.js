const cheerio = require('cheerio');
const fs = require('node:fs/promises');
const path = require('node:path');
const seed = require('../data/season-seed.json');
const {isuFetch}=require('./isu-fetch');
const {mergeAthletes}=require('./athletes');
const {parseCareerMedals,parseBio}=require('./athlete-archive');
const eventPhotos=require('../data/event-photos.json');
const eventPhotoFile=path.join(__dirname,'../data/event-photos.json');
const verifiedEvents=new Map(seed.events.filter(event=>event.podium.length===3).map(event=>[event.id,event]));
const SYNC_INTERVAL = 6 * 60 * 60 * 1000;
const ARCHIVE_INTERVAL = 24 * 60 * 60 * 1000;
const clean = text => String(text || '').replace(/\s+/g, ' ').trim();
const athleteId = name => clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function approvedUrl(value, base) {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || !['results.isu.org', 'www.isuresults.com', 'isuresults.com'].includes(url.hostname)) throw new Error('Unsupported ISU address');
  return url.href;
}
function parseEventIndex(html, event) {
  const $ = cheerio.load(html);
  let result;
  $('tr').each((_, row) => {
    const cells = $(row).children('td');
    if (!cells.length) return;
    const label = clean(cells.first().text());
    const desired = event.group === 'junior' ? 'Junior Women' : 'Women';
    if (label !== desired) return;
    const link = $(row).find('a').toArray().find(a => /^Result$/i.test(clean($(a).text())) && /CAT\d+RS\.htm$/i.test($(a).attr('href') || ''));
    if (link) result = approvedUrl($(link).attr('href'), event.resultIndex);
  });
  const body = clean($('body').text());
  const dates = body.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/);
  return { resultUrl: result, dates: dates ? { start: `${dates[3]}-${dates[2]}-${dates[1]}`, end: `${dates[6]}-${dates[5]}-${dates[4]}` } : null };
}
function parseFinalResult(html, event) {
  const $ = cheerio.load(html);
  // 仅接收分类总成绩表 FPl.，禁止把 SP/FS 单项排名当成最终名次。
  if (!/FPl\./i.test($('body').text())) return [];
  const podium = [];
  $('tr').each((_, row) => {
    const cells = $(row).children('td');
    if (cells.length < 6) return;
    const place = Number(clean(cells.eq(0).text()));
    const link = cells.eq(1).find('a[href*="/bios/"]').first();
    const name = clean(link.text());
    const score = Number(clean(cells.eq(3).text()));
    if (![1, 2, 3].includes(place) || !name || !Number.isFinite(score) || score <= 0) return;
    // 最终总成绩必须已有 SP 和 FS 名次，空白自由滑栏目不能产生领奖台。
    if (!/^\d+$/.test(clean(cells.eq(4).text())) || !/^\d+$/.test(clean(cells.eq(5).text()))) return;
    podium.push({ place, score, athlete: { id: athleteId(name), name, country: clean(cells.eq(2).text()), groups: [event.group], bioUrl: approvedUrl(link.attr('href'), event.resultIndex) } });
  });
  podium.sort((a,b)=>a.place-b.place);
  return podium.length === 3 && new Set(podium.map(p=>p.place)).size === 3 ? podium : [];
}
async function createSeasonService({ db, enabled = true, fetcher = isuFetch }) {
  const collection = db.collection('season_cache');
  await collection.updateOne({ _id: seed.season }, { $setOnInsert: { ...structuredClone(seed), _id: seed.season } }, { upsert: true });
  let running = false;
  let stopped = false;
  const controllers = new Set();
  async function read() {
    const [stored,photos]=await Promise.all([
      collection.findOne({ _id: seed.season }, { projection: { _id: 0 } }),
      fs.readFile(eventPhotoFile,'utf8').then(JSON.parse).catch(()=>eventPhotos)
    ]);
    const { athleteArchives = {}, ...snapshot } = stored;
    const events=snapshot.events.map(event=>{
      const verified=verifiedEvents.get(event.id);
      const result=verified&&event.podium?.length!==3 ? {podium:verified.podium,source:verified.source} : {};
      return {...event,...result,...photos?.[event.id]};
    });
    return { ...snapshot, events, athletes:mergeAthletes(snapshot.athletes, athleteArchives), syncing: running, nextSyncAt: snapshot.lastAttemptAt ? new Date(Date.parse(snapshot.lastAttemptAt) + SYNC_INTERVAL).toISOString() : null };
  }
  async function getHtml(url) {
    approvedUrl(url, url);
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(()=>controller.abort(), 7000);
    try {
      const response = await fetcher(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'IceAtlas-CourseProject/1.0', Accept: 'text/html' } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('ISU response unavailable');
      approvedUrl(response.url || url, url);
      const html = await response.text();
      if (html.length > 1500000) throw new Error('Unexpected result size');
      return html;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  async function syncArchives(athletes, recentPodiums) {
    const { athleteArchives = {} } = await collection.findOne({ _id: seed.season }, { projection: { athleteArchives: 1 } });
    const now = Date.now();
    const queue = athletes.filter(({id}) => recentPodiums.has(id) ||
      now - (Date.parse(athleteArchives[id]?.checkedAt) || 0) >= ARCHIVE_INTERVAL);
    let cursor = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (!stopped && cursor < queue.length) {
        const athlete = queue[cursor++];
        const id = athlete.bioUrl?.match(/\/bios\/isufs(\d+)\.htm$/i)?.[1];
        if (!id || !/^[a-z0-9-]+$/.test(athlete.id)) continue;
        const bio = 'https://results.isu.org/bios/isufs' + id + '.htm';
        const careerSource = bio.replace('/isufs', '/isufs_cr_');
        const fields = {};
        try {
          const html = await getHtml(bio);
          if (html) Object.assign(fields, parseBio(html));
        } catch { /* Keep the last successful bio. */ }
        try {
          const html = await getHtml(careerSource);
          if (html && /Competition Results/i.test(html)) {
            fields.careerMedals = parseCareerMedals(html, careerSource);
            fields.careerSource = careerSource;
          }
        } catch { /* Keep the last successful career archive. */ }
        if (stopped || !Object.keys(fields).length) continue;
        if (fields.personalBest && fields.careerMedals) fields.checkedAt = new Date(now).toISOString();
        const patch = {};
        for (const [key,value] of Object.entries(fields)) patch['athleteArchives.' + athlete.id + '.' + key] = value;
        await collection.updateOne({ _id: seed.season }, { $set: patch });
      }
    }));
    if (!stopped) await collection.updateOne({ _id: seed.season }, { $set: { archiveAttemptAt: new Date(now).toISOString() } });
  }
  async function sync() {
    if (running || stopped) return;
    running = true;
    try {
      const snapshot = await read();
      const athletes = new Map(snapshot.athletes.map(a=>[a.id,a]));
      const recentPodiums = new Set();
      let successes = 0; const failures = [];
      const events = structuredClone(snapshot.events);
      let cursor = 0;
      await Promise.all(Array.from({length:3},async()=>{
        while (cursor < events.length && !stopped) {
          const event = events[cursor++];
          try {
            const html = await getHtml(event.resultIndex);
            if (!html) { if (event.end < new Date().toISOString().slice(0,10)) failures.push(event.id); continue; }
            const info = parseEventIndex(html,event);
            if (info.dates && info.dates.start >= seed.seasonStart && info.dates.end <= seed.seasonEnd && info.dates.start <= info.dates.end) {
              event.start = info.dates.start; event.end = info.dates.end; event.scheduleSource = event.resultIndex;
            }
            event.checkedAt = new Date().toISOString(); successes++;
            if (!info.resultUrl) continue;
            const finalHtml = await getHtml(info.resultUrl);
            const podium = finalHtml ? parseFinalResult(finalHtml,event) : [];
            if (podium.length !== 3) continue;
            const previousPodium = JSON.stringify(event.podium);
            event.podium = podium.map(({place,score,athlete})=>{
              const previous = athletes.get(athlete.id);
              athletes.set(athlete.id,{...previous,...athlete,groups:[...new Set([...(previous?.groups||[]),...athlete.groups])]});
              return {place,score,athleteId:athlete.id};
            });
            if (JSON.stringify(event.podium) !== previousPodium) {
              event.podium.forEach(result => recentPodiums.add(result.athleteId));
            }
            event.source = info.resultUrl; event.verifiedAt = new Date().toISOString();
          } catch { failures.push(event.id); }
        }
      }));
      if (stopped) return;
      const now = new Date().toISOString();
      const update = { lastAttemptAt: now, syncState: successes ? (failures.length ? 'partial' : 'ok') : 'unavailable', failedEvents: failures };
      if (successes) Object.assign(update,{events,athletes:[...athletes.values()],syncedAt:now});
      await collection.updateOne({_id:seed.season},{$set:update});
      await syncArchives([...athletes.values()], recentPodiums);
    } finally { running = false; }
  }
  let kickoff, timer;
  if (enabled) {
    const cached = await read();
    const run = async () => {
      await sync().catch(()=>console.error('赛事同步未完成，将保留缓存。'));
      if (!stopped) { timer=setTimeout(run,SYNC_INTERVAL);timer.unref(); }
    };
    const wait = cached.archiveAttemptAt && cached.lastAttemptAt ? Math.max(200,SYNC_INTERVAL-(Date.now()-Date.parse(cached.lastAttemptAt))) : 200;
    kickoff=setTimeout(run,wait);kickoff.unref();
  }
  return { read, sync, stop() { stopped=true; clearTimeout(kickoff); clearInterval(timer); for(const controller of controllers) controller.abort(); } };
}
module.exports = { createSeasonService, parseEventIndex, parseFinalResult };
