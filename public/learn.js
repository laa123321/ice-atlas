// 科普内容与依据分开维护；分值适用于 2026/27，图片署名与每个知识点同时展示。
const LEARN_SOURCES = {
  handbook: 'https://isu-d8g8b4b7ece7aphs.a03.azurefd.net/isudamcontainer/CMS/Corporate-Site/Sports-Rules/Figure-Skating-Rules/Handbooks-Single-%26-Pair-Skating/TP-HandbookSingles-26-27-15-July-2026-1784641784-3364.pdf',
  jumps: 'https://www.isu-skating.com/en/news/figure-skating-jumps-explained/',
  values: 'https://www.nzifsa.nzisa.com/rules/2786-SinglesPairs-SOV-Update-260602.pdf',
  rules: 'https://isudam.blob.core.windows.net/isudamcontainer/2026-FS---Pair-Sports-Rules-FINAL-20260513-as-of-1-June-2026-1780065543-6198.pdf'
};
const JUMP_KNOWLEDGE = [
  { id:'toe-loop', code:'T', name:'后外点冰跳', en:'Toe Loop', family:'点冰跳', takeoff:'右脚后外刃', assist:'左脚点冰', landing:'右脚后外刃', description:'以右后外刃滑行，左脚齿点冰辅助起跳，完成旋转后落回右后外刃。判断时要看“哪只脚持刃、哪只脚点冰”。', key:'起跳持刃脚与落冰脚相同，常作为连跳的后一个跳跃。', values:[0.40,1.30,4.20,9.50] },
  { id:'salchow', code:'S', name:'后内结环跳', en:'Salchow', family:'刃跳', takeoff:'左脚后内刃', assist:'不靠另一脚点冰', landing:'右脚后外刃', description:'从左后内刃起跳，右腿配合摆动，空中旋转后落在右后外刃。核心是后内刃起跳，而不是仅凭起跳前双腿外形辨认。', key:'后内刃起跳，换另一只脚落冰。', values:[0.40,1.30,4.30,9.70] },
  { id:'loop', code:'Lo', name:'后外结环跳', en:'Loop', family:'刃跳', takeoff:'右脚后外刃', assist:'不靠另一脚点冰', landing:'右脚后外刃', description:'从右后外刃直接起跳，并落回右后外刃。支撑腿与身体轴线的控制很重要；外观相似的预备姿势并不一定是同一种跳跃。', key:'后外刃起跳，同脚后外刃落冰。', values:[0.50,1.70,4.90,10.50] },
  { id:'flip', code:'F', name:'后内点冰跳', en:'Flip', family:'点冰跳', takeoff:'左脚后内刃', assist:'右脚点冰', landing:'右脚后外刃', description:'左脚保持后内刃，右脚齿点冰辅助起跳，落在右后外刃。与勾手跳最大的区别是起跳刃：Flip 用内刃。', key:'记住“F 看内刃”，不要只看进入动作。', values:[0.50,1.80,5.30,11.00] },
  { id:'lutz', code:'Lz', name:'勾手跳（鲁兹）', en:'Lutz', family:'点冰跳', takeoff:'左脚后外刃', assist:'右脚点冰', landing:'右脚后外刃', description:'左脚以后外刃进入，右脚齿辅助起跳。起跳前滑行弧线与空中旋转的反向关系，是勾手跳的关键特征；中文也称“后外点冰跳”，需结合 Lz 代码辨认。', key:'Lz 看外刃；内外刃不清或错误会影响判定与得分。', values:[0.60,2.10,5.90,11.50] },
  { id:'axel', code:'A', name:'前外跳（阿克塞尔）', en:'Axel', family:'刃跳', takeoff:'左脚前外刃', assist:'不靠另一脚点冰', landing:'右脚后外刃', description:'六种主要跳跃中，Axel 是唯一向前起跳的种类。向前起跳、向后落冰，所以名义周数之外还多半周：1A 为一周半，2A 为两周半，3A 为三周半。', key:'认清向前起跳；Axel 是刃跳，不是点冰跳。', values:[1.10,3.30,8.00,12.50] }
];

const SPIN_KNOWLEDGE = [
  { id:'upright', code:'USp / U', name:'直立旋转', en:'Upright spin', image:'upright', page:26, description:'支撑腿伸直或略屈、身体保持直立的旋转，且不属于燕式姿态。手臂、浮腿的位置可以变化；图中为手册列出的直立姿态难度变式。', key:'先看支撑腿与身体姿态。USp 是元素码，US 等是姿态变式分类码。' },
  { id:'sit', code:'SSp / S', name:'蹲踞旋转', en:'Sit spin', image:'sit', page:26, description:'支撑腿深屈膝，支撑腿大腿至少与冰面平行。身体坐低是蹲踞姿态识别的基础；仅仅弯腰或稍微屈膝，并不等于达到蹲踞基本姿态。', key:'看支撑腿大腿高度，不要只看头部是否很低。' },
  { id:'camel', code:'CSp / C', name:'燕式旋转', en:'Camel spin', image:'camel', page:25, description:'浮腿向后伸展，浮腿膝部高于髋部。躯干与浮腿形成舒展的长线条；姿态认定看浮腿膝与髋的关系，不仅凭上身是否接近水平。', key:'浮腿向后、膝部高于髋部。' },
  { id:'layback', code:'LSp / UL', name:'躬身旋转', en:'Layback spin', image:'layback', page:26, description:'在直立旋转基础上，上身向后或侧方弯曲，头部随之后仰或侧倾。常见于女单，但不能把所有后弯的持刃造型都视作同一种计分元素。', key:'躬身是姿态特征；具体元素码还取决于整段旋转结构。' },
  { id:'biellmann', code:'UB', name:'贝尔曼姿态', en:'Biellmann position', image:'biellmann', page:26, description:'将浮腿从身后拉起，冰鞋接近头顶上方和身体旋转轴。它属于直立姿态的难度变式，不是额外独立计分的一段旋转。', key:'持刃并抬高不一定就是贝尔曼，要看冰鞋与头部、旋转轴的关系。' },
  { id:'camel-sideways', code:'CS', name:'燕式侧倾变式', en:'Camel sideways', image:'camel-sideways', page:25, description:'保持燕式基本姿态，上身转向侧方。作为难度特征，还须有影响身体核心平衡、需要力量或柔韧性的变化；单纯转一下肩膀不一定够。', key:'CS 是变式分类，不是与 CSp 并列的独立旋转元素。' },
  { id:'camel-upward', code:'CU', name:'燕式仰身变式', en:'Camel upward', image:'camel-upward', page:25, description:'在燕式基本姿态中，上身明显翻转朝上。观察时先确认仍保持燕式所需的浮腿位置，再区分上身朝向。', key:'“仰身”描述上身方向，基本姿态仍然是燕式。' },
  { id:'sit-sideways', code:'SS', name:'蹲踞侧向变式', en:'Sit sideways', image:'sit-sideways', page:26, description:'在合格的蹲踞基本姿态中，浮腿或身体向侧面变化。支撑腿高度仍需达标，姿态的难度不能只用造型是否好看判断。', key:'先符合蹲踞定义，再看侧向变化。' },
  { id:'sit-behind', code:'SB', name:'蹲踞向后变式', en:'Sit behind', image:'sit-behind', page:26, description:'保持低位蹲踞，将浮腿带向身后或采用向后收拢的造型。手册用不同方向对难度变式归类，具体等级还取决于完成的有效特征。', key:'蹲踞基本姿态不因浮腿方向变化而改变。' },
  { id:'upright-forward', code:'UF', name:'直立前倾变式', en:'Upright forward', image:'upright-forward', page:26, description:'在直立基本姿态中前屈上身，例如常被称作“折刀式”的造型。它与蹲踞的区别在支撑腿是否达到蹲踞姿态要求。', key:'上身低不代表蹲踞，必须一起看支撑腿。' }
];
const STEP_KNOWLEDGE = [
  { id:'three-turn', name:'三字转', en:'Three turn', code:'3', type:'单足转体', entry:'左前外刃', exit:'左后内刃', relation:'同足 · 换刃 · 同一弧瓣', rotation:'顺进入弧线方向转体', description:'单脚由前滑转后滑，或由后滑转前滑，同时换内外刃。转体方向顺着进入弧线，刃迹形似数字 3。它是基础转体，不属于定级所列的六类难步。' },
  { id:'bracket', name:'括弧步', en:'Bracket', code:'Br', type:'难度单足转体', entry:'左前外刃', exit:'左后内刃', relation:'同足 · 换刃 · 同一弧瓣', rotation:'逆进入弧线方向转体', description:'同脚转身并换刃，转体方向与进入弧线相反。它和三字转的用刃变化可以相同，区别在身体转动方向与弧线的关系。' },
  { id:'rocker', name:'摇滚步', en:'Rocker', code:'Rk', type:'难度单足转体', entry:'左前外刃', exit:'左后外刃', relation:'同足 · 不换刃 · 换弧瓣', rotation:'顺进入弧线方向转体', description:'单脚改变前后滑行方向，保持相同的刃类，转体后进入另一弧瓣。身体转动方向顺着进入弧线。' },
  { id:'counter', name:'反向摇滚步', en:'Counter', code:'Ct', type:'难度单足转体', entry:'左前外刃', exit:'左后外刃', relation:'同足 · 不换刃 · 换弧瓣', rotation:'逆进入弧线方向转体', description:'与 Rocker 一样保持内外刃类别并换弧瓣，但身体转动方向逆着进入弧线。判断二者时，要同时观察进入弧线和转体方向。' },
  { id:'loop-turn', name:'结环步', en:'Loop turn', code:'Lp', type:'难度单足转体', entry:'同一只脚持刃', exit:'同一刃继续滑出', relation:'同足 · 不换刃 · 小环形刃迹', rotation:'在冰面上完成小环形路线', description:'用一只脚在冰面画出紧凑的小环并继续滑出，强调连贯持刃。它是冰面上的转体，和空中旋转的 Loop 跳跃不是同一个动作。' },
  { id:'twizzle', name:'捻转步', en:'Twizzle', code:'Tw', type:'难度单足转体', entry:'单足滑行', exit:'继续移动滑出', relation:'单足 · 连续转动 · 中心前移', rotation:'单人 StSq 中至少两周才计为该难步', description:'身体在单足上连续旋转，同时沿冰面行进，旋转中心持续移动。单人滑接续步定级中，捻转至少两周才计入；它不是原地旋转。' },
  { id:'mohawk', name:'莫霍克步', en:'Mohawk', code:'Mo', type:'换足步', entry:'左前内刃', exit:'右后内刃', relation:'换足 · 同刃类 · 改变前后方向', rotation:'进入与滑出弧线连续', description:'由一只脚换到另一只脚，同时改变前后滑行方向，保持同为内刃或同为外刃。它不属于单人 StSq 定级中的六类难步。' },
  { id:'choctaw', name:'乔克塔步', en:'Choctaw', code:'Ch', type:'难度换足步', entry:'左前内刃', exit:'右后外刃', relation:'换足 · 换刃 · 换弧瓣', rotation:'前滑与后滑互换', description:'同时换脚、换内外刃并改变前后滑行方向，出口弧线与入口弧线相反。它是单人接续步中列出的难度步法之一。' },
  { id:'change-edge', name:'换刃', en:'Change of edge', code:'CE', type:'基础用刃', entry:'同足前外刃', exit:'同足前内刃', relation:'同足 · 换刃 · 前后方向不变', rotation:'不要求转身', description:'在同一只脚上从外刃切换到内刃，或从内刃切换到外刃，保持前滑或后滑方向。它是控制曲线与连接动作的重要基础。' },
  { id:'chasse', name:'夏塞步', en:'Chassé', code:'Chassé', type:'基础换足步', entry:'一脚持刃滑行', exit:'另一脚接替承重', relation:'换足承重 · 双脚靠近', rotation:'以交替抬脚连接滑行', description:'另一脚在支撑脚旁接替承重，原支撑脚抬离冰面；并非简单把一脚拖在冰面上。它常用于节奏变化和动作连接。' },
  { id:'cross-roll', name:'交叉滚步', en:'Cross roll', code:'CR', type:'基础换足步', entry:'左脚外刃弧线', exit:'右脚外刃新弧线', relation:'交叉换足 · 外刃接外刃', rotation:'换入相反弧线', description:'通过前方或后方的交叉换足，从一脚的外刃转移到另一脚外刃，并滑入相反曲线。重心与弧线的滚动感是识别重点。' },
  { id:'toe-step', name:'点冰步', en:'Toe steps', code:'Toe', type:'基础步法', entry:'脚齿接触冰面', exit:'继续连接滑行', relation:'利用脚齿支撑或步进', rotation:'不等同于列名跳跃', description:'利用冰刀前端脚齿完成步进、节奏点或连接动作。点冰步是步法的一部分，不能仅凭一次脚齿触冰就认定为点冰跳。' }
];
const LEARN_TOPICS = [
  { id:'jumps', name:'跳跃', en:'JUMPS', number:'01', summary:'从起跳刃到落冰，看懂六种主要跳跃。', list:JUMP_KNOWLEDGE, icon:'↗' },
  { id:'spins', name:'旋转', en:'SPINS', number:'02', summary:'认识三类基本姿态，以及常见难度变式。', list:SPIN_KNOWLEDGE, icon:'◎' },
  { id:'steps', name:'步法', en:'STEPS & TURNS', number:'03', summary:'用刃、转体和换足，读懂冰上的连接。', list:STEP_KNOWLEDGE, icon:'⌁' },
  { id:'scoring', name:'积分规则', en:'SCORING', number:'04', summary:'拆解节目得分，并列查询一至四周跳基础分。', icon:'＋' }
];
function learnHref(topic, item) { return `#/basics?topic=${topic}${item ? `&item=${item}` : ''}`; }
function learnSource(url,label) { return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`; }
function knowledgeCard(item,index,topic) {
  const official = topic === 'spins';
  const image = `assets/learn/${official ? item.image + '.png' : topic + '-' + item.id + '.svg'}`;
  const imageNote = official ? `ISU 技术手册 2026/27 · 第 ${item.page} 页姿态示例` : '本站绘制示意图 · 非 ISU 原图';
  const source = official ? LEARN_SOURCES.handbook + '#page=' + item.page : topic === 'jumps' ? LEARN_SOURCES.jumps : LEARN_SOURCES.rules + '#page=82';
  const facts = topic === 'jumps' ? `<dl class="motion-facts"><div><dt>起跳刃</dt><dd>${item.takeoff}</dd></div><div><dt>辅助方式</dt><dd>${item.assist}</dd></div><div><dt>落冰刃</dt><dd>${item.landing}</dd></div></dl>` : topic === 'steps' ? `<p class="motion-relation">${item.relation}</p><p class="motion-direction">${item.rotation}</p>` : '';
  return `<article class="knowledge-card" id="learn-${item.id}" tabindex="-1"><div class="knowledge-copy"><p class="knowledge-number">${String(index+1).padStart(2,'0')} / ${item.family || item.type || 'SPIN POSITION'}</p><h3>${item.name}<span>${item.code}</span></h3><p class="knowledge-en">${item.en}</p><p class="knowledge-description">${item.description}</p>${facts}${item.key ? `<p class="knowledge-key"><span>识别重点</span>${item.key}</p>` : ''}<p class="knowledge-source">${learnSource(source,official ? '核对手册原文' : '核对 ISU 定义')}</p></div><figure class="knowledge-figure ${official?'official-figure':''}"><a href="${image}" target="_blank" rel="noopener noreferrer" aria-label="放大查看${item.name}图示"><img src="${image}" alt="${official?'ISU 手册中的':'本站绘制的'}${item.name}示例" loading="lazy" width="520" height="300"></a><figcaption>${imageNote}</figcaption></figure></article>`;
}
function scoreContent() {
  const names = ['一周跳','两周跳','三周跳','四周跳'];
  return `<div class="score-intro"><p class="eyebrow">UNDERSTAND THE SCORE</p><h2>一套节目，分数从哪里来？</h2><p>这里讲的是比赛节目得分；它与“世界积分排名”是两套不同的数值。</p></div>
  <section id="learn-total" class="score-section"><h3>01 / 从节目得分，到比赛总分</h3><div class="score-equation"><span><small>技术分</small>TES</span><b>＋</b><span><small>节目内容分</small>PCS</span><b>−</b><span><small>违规扣分</small>Deductions</span><b>＝</b><span class="equation-result"><small>单套节目得分</small>TSS</span></div><p>比赛总分＝短节目得分（SP）＋自由滑得分（FS）。自由滑与短节目各自先按上式计算，再相加。</p>${learnSource(LEARN_SOURCES.rules+'#page=12','ISU Sports Rules · Rule 353')}</section>
  <section id="learn-tes" class="score-section"><h3>02 / 技术分 TES：难度与完成质量一起算</h3><p>每个元素的得分＝基础分值 BV＋执行分 GOE；把所有有效元素相加，得到 TES。跳跃按种类与周数定基础分，旋转、接续步通常按识别出的等级定基础分。</p><p>裁判先给出 −5 至 +5 的执行等级，再按该元素的分值表换算成实际分数；<strong>“GOE +3”不等于直接加 3 分。</strong>例如 3Lz 的 BV 为 5.90，+3 对应 +1.77，元素得分为 7.67。</p>${learnSource(LEARN_SOURCES.values,'ISU Communication 2786 · 分值表')}</section>
  <section id="learn-pcs" class="score-section"><h3>03 / 节目内容分 PCS：三个方面看整套表演</h3><div class="pcs-grid"><div><span>COMPOSITION</span><h4>编排</h4><p>动作组织、连接、空间运用，以及与音乐结构的关系。</p></div><div><span>PRESENTATION</span><h4>表现</h4><p>投入程度、表达、能量变化与音乐感受。</p></div><div><span>SKATING SKILLS</span><h4>滑行技术</h4><p>用刃、转体、身体控制、平衡、流畅度与速度。</p></div></div><p>三个项目分别评分，经规定方式汇总后乘以项目系数。2026/27 成年与青年女单：短节目系数 <strong>1.33</strong>，自由滑系数 <strong>2.67</strong>。</p>${learnSource(LEARN_SOURCES.rules+'#page=52','ISU Rule 504 · PCS 定义')} · ${learnSource(LEARN_SOURCES.values+'#page=14','2786 · 女单系数')}</section>
  <section id="learn-deductions" class="score-section"><h3>04 / 扣分与技术判定，作用的位置不同</h3><p>摔倒、超时、服装等违规可能产生独立扣分；摔倒也会影响该元素的 GOE。基础分降低或元素无效，则反映在 TES 的计算中，不能把这些都当作同一栏的扣分。</p><div class="call-grid"><div><b>q</b><span>落冰恰好缺四分之一周，BV 不因 q 本身降低，GOE 需考虑。</span></div><div><b>&lt;</b><span>缺周超过四分之一、少于二分之一，按不足周数的较低分值计算。</span></div><div><b>&lt;&lt;</b><span>缺周达到二分之一或更多，按少一周的跳跃降组计算。</span></div><div><b>! / e</b><span>Flip、Lutz 起跳刃不清 / 用刃错误；两种标记的处理并不相同。</span></div></div>${learnSource(LEARN_SOURCES.handbook+'#page=31','ISU 技术手册 · 跳跃判定')}</section>
  <section id="learn-base-values" class="score-section jump-values-section"><div class="values-heading"><div><p class="eyebrow">SCALE OF VALUES / 2026–27</p><h3>05 / 一周到四周跳，基础分并排查</h3></div>${learnSource(LEARN_SOURCES.values,'ISU 2786 原始分值表')}</div><p>仅列完整周数、正确起跳刃、无附加标记的标准 BV；未计 GOE、后半程奖励、缺周或其他规则调整。表中列有分值，不代表该跳在所有组别、所有节目中都允许使用。</p><div class="jump-values-grid">${names.map((name,rotation)=>`<table class="jump-values"><caption><span>0${rotation+1}</span>${name}</caption><thead><tr><th scope="col">跳跃</th><th scope="col">代码</th><th scope="col">BV</th></tr></thead><tbody>${JUMP_KNOWLEDGE.map(jump=>`<tr><th scope="row"><a href="${learnHref('jumps',jump.id)}">${jump.en}</a></th><td>${rotation+1}${jump.code}</td><td>${jump.values[rotation].toFixed(2)}</td></tr>`).join('')}</tbody></table>`).join('')}</div><p class="learn-smallprint">Axel 名义周数比实际空中转体少半周：一周 Axel 为 1.5 周，四周 Axel 为 4.5 周。本表按 ISU 记法标示。</p></section>
  <section id="learn-example" class="score-section"><h3>06 / 一个简短算例</h3><p>假设一套节目的 TES 为 35.00、PCS 为 28.00、独立扣分为 1.00，则该套节目得分为 <strong>35.00＋28.00−1.00＝62.00</strong>。这是帮助理解公式的示例，不对应任何真实选手成绩。</p></section>`;
}
function learnCategoryGraphic(id) {
  const paths={
    jumps:'<path d="M8 57h64M12 52c12-1 13-33 30-33s18 33 30 33"/><path d="m65 45 7 7-9 2M27 20l3-6m20 0 3 6"/>',
    spins:'<path d="M40 9v62" stroke-dasharray="3 5"/><ellipse cx="40" cy="39" rx="26" ry="12"/><path d="m58 23 7 8-11 1M28 61c-11-2-17-7-17-13"/>',
    steps:'<path d="M11 60c-4-18 27-13 25-30S9 12 14 26s39-3 46 10-16 23-4 28"/><path d="m50 63 6 1 5-5"/>',
    scoring:'<path d="M14 15h52v52H14zM14 32h52M32 15v52M49 15v52M14 49h52"/><path d="m20 41 3 3 4-6m10 3 3 3 4-6m10 3 3 3 4-6"/>'
  };
  return `<svg class="learn-card-diagram" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[id]}</svg>`;
}
function renderLearn(raw) {
  const params = new URLSearchParams(raw.split('?')[1] || '');
  const topic = LEARN_TOPICS.find(t=>t.id===params.get('topic'));
  blankCanvas.className = 'learn-content';
  blankCanvas.setAttribute('aria-label','花样滑冰科普内容');
  if (!topic) {
    blankCanvas.innerHTML = `<div class="learn-index-intro"><p><strong>看见精彩，也读懂精彩。</strong><span>从一条刃、一种姿态开始，认识冰上的技术与艺术。</span></p></div><div class="learn-directory">${LEARN_TOPICS.map(t=>`<a class="learn-directory-card" href="${learnHref(t.id)}"><div class="learn-card-copy"><span class="directory-number">${t.number} / ${t.en}</span><h2 class="learn-card-title">${t.name}</h2><p>${t.summary}</p></div>${learnCategoryGraphic(t.id)}<div class="learn-card-footer"><span class="directory-tail">${t.list ? `${t.list.length} 个知识点` : '得分组成 · 四组分值表'}</span><span class="learn-card-arrow" aria-hidden="true">↗</span></div></a>`).join('')}</div><div class="learn-source-note"><span class="learn-guide-label">A FIELD GUIDE TO FIGURE SKATING</span><span>内容依据 ISU 2026/27 规则与官方技术手册。</span>${learnSource(LEARN_SOURCES.handbook,'技术手册')} · ${learnSource(LEARN_SOURCES.rules,'体育规则')} · ${learnSource(LEARN_SOURCES.values,'基础分值表（官方文件镜像）')}</div>`;
    return;
  }
  const items = topic.list || [{id:'total',name:'得分组成'},{id:'tes',name:'技术分 TES'},{id:'pcs',name:'节目内容分 PCS'},{id:'deductions',name:'扣分与判定'},{id:'base-values',name:'四组跳跃分值表'},{id:'example',name:'计算示例'}];
  const intro = topic.id==='jumps' ? '以下以逆时针转体选手为例；顺时针选手左右脚镜像。后外点冰跳 T 与 Lz 的中文名相近，请结合英文与代码区分。图示只说明动作结构，不表示精确刃迹、角度或训练时序。' : topic.id==='spins' ? '三类基本姿态是直立、蹲踞、燕式。下面先认识基本姿态，再看常见变式；每个元素的等级仍由技术组根据有效特征判定，不能凭一张姿态图直接判断等级。' : topic.id==='steps' ? '先分清“单足转体”和“换足步”，再看是否换刃、是否改变弧瓣。示意图只帮助比较结构关系，不是按比例绘制的标准刃迹；步法代码为阅读辅助，不是独立计分元素码。' : '采用 ISU 2026/27 单人滑规则。先读公式，再看技术判定，最后并排查询四组基础分。';
  blankCanvas.innerHTML = `<div class="learn-topic-bar"><a href="#/basics">← 返回科普目录</a><span>${topic.number} / ${topic.en}</span></div><div class="learn-layout"><aside class="learn-sidebar"><nav aria-label="科普分类">${LEARN_TOPICS.map(t=>`<a href="${learnHref(t.id)}" ${t.id===topic.id?'aria-current="page"':''}><span>${t.number}</span>${t.name}<span aria-hidden="true">↗</span></a>`).join('')}</nav><p class="sidebar-heading">本页目录</p><nav class="knowledge-index" aria-label="本页知识点">${items.map((item,i)=>`<a href="${learnHref(topic.id,item.id)}"><span>${String(i+1).padStart(2,'0')}</span>${item.name}</a>`).join('')}</nav></aside><div class="learn-article"><header class="learn-topic-heading"><p class="eyebrow">${topic.en}</p><h2>${topic.name}</h2><p>${intro}</p></header>${topic.id==='scoring'?scoreContent():topic.list.map((item,index)=>knowledgeCard(item,index,topic.id)).join('')}<div class="learn-bottom-nav"><a href="#/basics">← 科普目录</a>${learnSource(topic.id==='scoring'?LEARN_SOURCES.values:LEARN_SOURCES.handbook,'查阅官方依据')}</div></div></div>`;
  document.title = `${topic.name} · 花滑科普 · ${siteTitle}`;
  const target = params.get('item');
  if (target && items.some(item=>item.id===target)) requestAnimationFrame(()=>document.querySelector(`#learn-${target}`)?.scrollIntoView({block:'start'}));
}
