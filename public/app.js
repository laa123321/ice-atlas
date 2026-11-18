// 首页照片数据。更换图片时，同时更新照片说明与原始来源。
const beijingSource = 'https://www.isu-skating.com/en/figure-skating/news/spectacular-anna-shcherbakova-roc-strikes-olympic-gold/';
const milanoSource = 'https://www.isu-skating.com/en/news/incredible-alysa-liu-strikes-gold-in-spectacular-finale/';
const editions = [
  { year: '2014', title: '2014 索契冬奥会', city: 'SOCHI', subtitle: '冰上绽放的奥运记忆', photos: [
    { file: 'sochi-1.jpg', caption: '索契冬奥会女子单人滑颁奖时刻', source: 'https://time.com/10044/must-see-photos-from-day-15-of-the-sochi-olympics/', credit: 'TIME / Reuters' },
    { file: 'sochi-yuna-free.jpg', caption: '金妍儿在2014年索契冬奥会的自由滑表演', source: 'https://commons.wikimedia.org/wiki/File:Yuna_Kim_2014_Olympic_Free_Skating.jpg', credit: 'David W. Carmichael / Wikimedia Commons · CC BY-SA 3.0（原图未修改）', license: 'https://creativecommons.org/licenses/by-sa/3.0/' },
    { file: 'sochi-3.jpg', caption: '浅田真央在索契冬奥会的自由滑表演', source: 'https://commons.wikimedia.org/wiki/File:Mao_Asada_at_the_2014_Olympics_(3).jpg', credit: 'David W. Carmichael / Wikimedia Commons · CC BY-SA 3.0（原图未修改）', license: 'https://creativecommons.org/licenses/by-sa/3.0/' }
  ] },
  { year: '2018', title: '2018 平昌冬奥会', city: 'PYEONGCHANG', subtitle: '音乐落下，精彩仍在继续', photos: [
    { file: 'pyeongchang-1.jpg', caption: '扎吉托娃在平昌冬奥会的自由滑表演', source: 'https://www.goldenskate.com/zagitova-edges-medvedeva-olympic-gold/', credit: 'Golden Skate / Danielle Earl' },
    { file: 'pyeongchang-2.jpg', caption: '平昌冬奥会，扎吉托娃与梅德韦杰娃手持吉祥物合影', source: 'https://news.ru/sport/lednikovyj-period-zapis-pesen-lichnaya-zhizn-kak-zhivet-alina-zagitova', credit: 'NEWS.ru，原图署名见来源页面' }
  ] },
  { year: '2022', title: '2022 北京冬奥会', city: 'BEIJING', subtitle: '跃起的勇气，落冰的光芒', photos: [
    { file: 'beijing-1.jpg', caption: '谢尔巴科娃在北京冬奥会的自由滑表演', source: beijingSource, credit: 'ISU 报道 / AFP' },
    { file: 'beijing-2.jpg', caption: '特鲁索娃在北京冬奥会的自由滑表演', source: beijingSource, credit: 'ISU 报道 / AFP' },
    { file: 'beijing-3.jpg', caption: '坂本花织在北京冬奥会的自由滑表演', source: beijingSource, credit: 'ISU 报道 / AFP' }
  ] },
  { year: '2026', title: '2026 米兰冬奥会', city: 'MILANO', subtitle: '新的故事，在冰上写下', photos: [
    { file: 'milano-1.jpg', caption: '刘美贤在米兰–科尔蒂纳冬奥会的自由滑表演', source: milanoSource, credit: 'ISU 报道 / Getty Images' },
    { file: 'milano-2.jpg', caption: '坂本花织在米兰–科尔蒂纳冬奥会的比赛瞬间', source: milanoSource, credit: 'ISU 报道 / Getty Images' },
    { file: 'milano-3.jpg', caption: '米兰–科尔蒂纳冬奥会女子单人滑领奖台合照', source: milanoSource, credit: 'ISU 报道 / Getty Images' }
  ] }
];

const grid = document.querySelector('#moments-grid');
const slidePositions = editions.map(() => 0);
const slideHoldUntil = editions.map(() => 0);
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentRoute = '';
let timer;
let hoveredCard = -1;
let dialogEdition = 0;
let dialogPosition = 0;
const dialog = document.querySelector('#photo-dialog');

editions.forEach((edition, index) => {
  const card = document.createElement('figure');
  card.className = 'moment-card';
  card.innerHTML = `<div class="moment-photo">
    ${edition.photos.map((photo, photoIndex) => `<img class="moment-slide${photoIndex === 0 ? ' is-active' : ''}" src="assets/${photo.file}" alt="${photo.caption}" width="1000" height="800" ${index === 3 ? 'style="object-position:center 30%"' : ''} aria-hidden="${photoIndex !== 0}">`).join('')}
    <span class="moment-year">${edition.year}</span>
    <button class="moment-prev" type="button" aria-label="${edition.year} 年影像上一张">‹</button><button class="moment-next" type="button" aria-label="${edition.year} 年影像下一张">›</button>
    <div class="moment-dots" role="group" aria-label="${edition.year} 年影像选择">${edition.photos.map((_, photoIndex) => `<button type="button" class="moment-dot${photoIndex === 0 ? ' is-active' : ''}" aria-label="${edition.year} 年第 ${photoIndex+1} 张" aria-pressed="${photoIndex===0}"></button>`).join('')}</div>
    <button class="moment-open moment-zoom" type="button" aria-label="查看${edition.title}影像详情">↗</button>
    </div><figcaption><p class="moment-edition">${edition.year} / ${edition.city}</p><h3 class="moment-title">${edition.title.replace(edition.year+' ','')}</h3></figcaption>`;
  card.addEventListener('mouseenter', () => { hoveredCard = index; });
  card.addEventListener('mouseleave', () => { hoveredCard = -1; });
  card.querySelector('.moment-open').addEventListener('click', () => openPhoto(index));
  const choose=position=>{slideHoldUntil[index]=Date.now()+4000;setCardSlide(index,position);};
  card.querySelector('.moment-prev').addEventListener('click',()=>choose(slidePositions[index]-1));
  card.querySelector('.moment-next').addEventListener('click',()=>choose(slidePositions[index]+1));
  card.querySelectorAll('.moment-dot').forEach((dot,position)=>dot.addEventListener('click',()=>choose(position)));
  const photoArea=card.querySelector('.moment-photo');let touchStart=null;
  photoArea.addEventListener('touchstart',event=>{if(event.touches.length!==1){touchStart=null;return;}touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  photoArea.addEventListener('touchend',event=>{if(!touchStart||!event.changedTouches.length)return;const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.25)choose(slidePositions[index]+(dx<0?1:-1));},{passive:true});
  photoArea.addEventListener('touchcancel',()=>{touchStart=null;},{passive:true});
  grid.append(card);
});

function advanceCard(index) {
  setCardSlide(index,slidePositions[index]+1);
}
function setCardSlide(index,position) {
  const card = grid.children[index];
  const length=editions[index].photos.length;
  slidePositions[index] = ((position % length)+length)%length;
  card.querySelectorAll('.moment-slide').forEach((image, photoIndex) => {
    const active = photoIndex === slidePositions[index];
    image.classList.toggle('is-active', active);
    image.setAttribute('aria-hidden', String(!active));
  });
  card.querySelectorAll('.moment-dot').forEach((dot, photoIndex) => {const active=photoIndex===slidePositions[index];dot.classList.toggle('is-active',active);dot.setAttribute('aria-pressed',String(active));});
}

function syncTimer() {
  clearInterval(timer);
  if (paused || document.hidden || currentRoute !== '/' || dialog.open) return;
  timer = setInterval(() => editions.forEach((_, index) => {
    const active=document.activeElement;
    const usingCarouselControl=grid.children[index].contains(active)&&!active.classList.contains('moment-open');
    if (index !== hoveredCard && Date.now()>=slideHoldUntil[index] && !usingCarouselControl) advanceCard(index);
  }), 1000);
}

document.addEventListener('visibilitychange', syncTimer);

function renderPhoto() {
  const edition = editions[dialogEdition];
  const photo = edition.photos[dialogPosition];
  const image = document.querySelector('#dialog-image');
  image.src = `assets/${photo.file}`;
  image.alt = photo.caption;
  document.querySelector('#dialog-edition').textContent = `${edition.city} ${edition.year} · ${photo.credit}`;
  document.querySelector('#dialog-title').textContent = photo.caption;
  document.querySelector('#dialog-source').href = photo.source;
  document.querySelector('#dialog-count').textContent = `${dialogPosition + 1} / ${edition.photos.length}`;
}
function openPhoto(index) {
  dialogEdition = index;
  dialogPosition = slidePositions[index];
  renderPhoto();
  dialog.showModal();
  document.body.classList.add('modal-open');
  syncTimer();
}
function movePhoto(direction) { dialogPosition = (dialogPosition + direction + editions[dialogEdition].photos.length) % editions[dialogEdition].photos.length; renderPhoto(); }
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-prev').addEventListener('click', () => movePhoto(-1));
document.querySelector('.dialog-next').addEventListener('click', () => movePhoto(1));
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); movePhoto(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); movePhoto(1); }
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); hoveredCard=-1;slideHoldUntil[dialogEdition]=0;syncTimer(); });

const siteTitle = '冰上图鉴 · 女单篇 | ICE ATLAS';
const pages = {
  '/basics': ['花样滑冰基础知识科普', 'THE BASICS OF FIGURE SKATING'],
  '/rankings': ['世界积分榜排名', 'WORLD STANDINGS'],
  '/events': ['本赛季国际赛事', 'THE INTERNATIONAL SEASON'],
  '/athlete': ['选手简介', 'ATHLETE PROFILE'],
  '/skaters': ['女子单人滑选手图鉴', 'WOMEN’S SKATER ATLAS'],
  '/forum': ['论坛', 'THE ICE COMMUNITY'],
  '/sources': ['图片来源', 'PHOTOGRAPHY & CREDITS']
};
const blankCanvas = document.querySelector('.blank-canvas');
const blankMarkup = blankCanvas.innerHTML;
function bindGroupTabs(tablist) {
  tablist.onkeydown = event => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const targets = {ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1};
    const tab = tabs[targets[event.key]];
    if (!tab) return;
    event.preventDefault();
    tab.focus({preventScroll:true});
    tab.click();
  };
}

function selectGroupTab(tablist, panel, group) {
  for (const tab of tablist.querySelectorAll('[role="tab"]')) {
    const selected = tab.hash.endsWith('=' + group);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel.setAttribute('aria-labelledby', tab.id);
  }
}

function renderRoute() {
  if (dialog.open) dialog.close();
  const raw = location.hash.slice(1) || '/';
  const route = raw.split('?')[0];
  if (route === '/senior' || route === '/junior') {
    const params = new URLSearchParams(raw.split('?')[1] || '');
    params.set('group', route === '/junior' ? 'junior' : 'senior');
    location.replace('#/skaters?' + params);
    return;
  }
  const valid = route === '/' || route === '/login' || route === '/register' || pages[route];
  if (!valid) { location.replace('#/'); return; }
  if (route === currentRoute && route === '/rankings') {
    renderRankings(raw);
    return;
  }
  if (route === currentRoute && route === '/skaters') {
    renderSeasonPage(route, raw);
    return;
  }
  if (route === currentRoute && route === '/events' && seasonSnapshot) {
    renderEvents(raw, true);
    return;
  }
  leaveForumCompose();
  currentRoute = route;
  document.body.classList.toggle('forum-page', route === '/forum');
  document.body.classList.toggle('rankings-compact-page', route === '/rankings');
  document.body.classList.toggle('atlas-directory-page', route === '/skaters');
  document.body.classList.toggle('events-calendar-page', route === '/events');
  document.body.classList.toggle('learn-index-page', route === '/basics' && !LEARN_TOPICS.some(topic => topic.id === new URLSearchParams(raw.split('?')[1] || '').get('topic')));
  const isAuth = route === '/login' || route === '/register';
  document.querySelector('#home-view').hidden = route !== '/';
  document.querySelector('#section-view').hidden = !pages[route];
  document.querySelector('#auth-view').hidden = !isAuth;
  document.querySelectorAll('.nav-inner>a').forEach(link => {
    if (link.hash === `#${route}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (pages[route]) {
    const [title, eyebrow] = pages[route];
    document.querySelector('#section-title').textContent = title;
    document.querySelector('#breadcrumb-label').textContent = title;
    document.querySelector('#section-eyebrow').textContent = eyebrow;
    document.querySelector('.section-season').hidden = true;
    document.querySelector('#forum-notice').hidden = route !== '/forum';
    blankCanvas.className = route === '/sources' ? 'source-list' : 'blank-canvas';
    blankCanvas.innerHTML = route === '/sources' ? `<p>本站为课程项目，图片用于页面设计展示，版权归原摄影者及权利人所有。以下保留原始报道与署名信息。</p><ul><li>首页合照：<a href="https://www.isu-skating.com/en/news/kaori-sakamoto-bids-golden-farewell-with-fourth-isu-world-title-in-prague/" target="_blank" rel="noopener noreferrer">2026 ISU 世界花样滑冰锦标赛女子领奖台</a> · ISU / Getty Images</li>${editions.map(edition => `<li>${edition.title}<ul>${edition.photos.map(photo => `<li><a href="${photo.source}" target="_blank" rel="noopener noreferrer">${photo.caption}</a> · ${photo.credit}</li>`).join('')}</ul></li>`).join('')}</ul>` : blankMarkup;
    if (route === '/rankings') renderRankings(raw);
    if (route === '/sources') blankCanvas.insertAdjacentHTML('beforeend','<p>赛事票券配图：用户提供并选定的 B 图（蓝色冰刀滑行与冰屑），作为花滑主题配图使用，非中国杯官方宣传图。</p>');
    if (route === '/sources') blankCanvas.querySelectorAll('li>ul>li').forEach((li, i) => {
      const photo = editions.flatMap(edition => edition.photos)[i];
      if (photo.license) { const a = document.createElement('a'); a.href = photo.license; a.textContent = ' · 许可协议'; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); }
    });
    blankCanvas.setAttribute('aria-label', route === '/sources' ? '图片来源与署名' : route === '/basics' ? '花样滑冰科普内容' : route === '/rankings' ? 'ISU 女单世界积分榜' : route === '/events' ? '本赛季赛事与官方赛果' : ['/skaters','/athlete'].includes(route) ? '选手资料与成绩' : '栏目内容预留区域');
    if(route==='/sources')blankCanvas.insertAdjacentHTML('beforeend',`<h2>科普图示与选手照片</h2><p>旋转姿态图片提取自 ${learnSource(LEARN_SOURCES.handbook+'#page=25','ISU 单人滑技术手册 2026/27 第25–26页')}。跳跃及步法 SVG 是本站依据 ISU 定义绘制的结构示意，非 ISU 原图。</p><p>选手照片来自对应的 ISU 官方档案，每位选手简介页照片下方均有来源链接。原始照片保存在本站素材目录，版权归原权利人所有。</p>`);
    document.title = `${title} · ${siteTitle}`;
    if (route === '/basics') renderLearn(raw);
    if (route === '/forum') renderForum(raw);
    if (['/events','/skaters','/athlete'].includes(route)) renderSeasonPage(route,raw);
  } else if (isAuth) {
    const register = route === '/register';
    const form = document.querySelector('#auth-form');
    form.reset();
    document.querySelector('#auth-feedback').textContent = '';
    document.querySelector('#username-field').hidden = !register;
    document.querySelector('#username').required = register;
    document.querySelector('#confirm-field').hidden = !register;
    document.querySelector('#confirm-password').required = register;
    document.querySelector('#confirm-password').setCustomValidity('');
    document.querySelector('#auth-title').textContent = register ? '开启你的冰上旅程' : '欢迎回到冰上图鉴';
    document.querySelector('#auth-subtitle').textContent = register ? '创建账号，与同好分享每一个心动瞬间。' : '登录后，参与冰上的每一次讨论。';
    document.querySelector('#auth-submit').innerHTML = `${register ? '注册' : '登录'} <span aria-hidden="true">↗</span>`;
    const password = document.querySelector('#password');
    password.type = 'password';
    password.autocomplete = register ? 'new-password' : 'current-password';
    document.querySelector('#toggle-password').textContent = '显示';
    document.querySelector('#toggle-password').setAttribute('aria-label', '显示密码');
    const next = new URLSearchParams(raw.split('?')[1] || '').get('next');
    ['login', 'register'].forEach(mode => {
      const tab = document.querySelector(`#${mode}-tab`);
      tab.href = `#/${mode}${next === 'forum' ? '?next=forum' : ''}`;
      if (route === `/${mode}`) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    document.title = `${register ? '注册' : '登录'} · ${siteTitle}`;
  } else document.title = siteTitle;
  updateAuthUI();
  window.scrollTo(0, 0);
  syncTimer();
}

document.querySelector('#toggle-password').addEventListener('click', () => {
  const input = document.querySelector('#password');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  const button = document.querySelector('#toggle-password');
  button.textContent = visible ? '隐藏' : '显示';
  button.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
});
const confirmation = document.querySelector('#confirm-password');
function validateConfirmation() { confirmation.setCustomValidity(currentRoute === '/register' && confirmation.value !== document.querySelector('#password').value ? '两次输入的密码不一致' : ''); }
confirmation.addEventListener('input', validateConfirmation);
document.querySelector('#password').addEventListener('input', validateConfirmation);
window.addEventListener('hashchange', renderRoute);
renderRoute();
