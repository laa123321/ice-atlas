const FORUM_CATEGORIES=['赛事讨论','选手交流','技术分析','自由交流'];
let forumRenderVersion=0;
const forumTime=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false});
function forumLogin(){showNotice('请先登录后再参与讨论。');location.hash='/login?next=forum';}
async function renderForum(raw){
 const version=++forumRenderVersion,params=new URLSearchParams(raw.split('?')[1]||'');
 const postId=params.get('post'),compose=params.get('view')==='new';
 blankCanvas.className='forum-content';blankCanvas.setAttribute('aria-label','花滑讨论论坛');document.querySelector('#forum-notice').hidden=true;
 blankCanvas.innerHTML='<p class="forum-empty" role="status">正在读取讨论…</p>';
 try{
  if(authChecking)await refreshAuth();
  if(version!==forumRenderVersion||currentRoute!=='/forum')return;
  if(compose){renderForumCompose();return;}
  const category=FORUM_CATEGORIES.includes(params.get('category'))?params.get('category'):'all';
  const page=Math.max(1,Number.parseInt(params.get('page'),10)||1);
  const data=await apiRequest(postId?`/api/forum/posts/${encodeURIComponent(postId)}`:`/api/forum/posts?category=${encodeURIComponent(category)}&page=${page}`);
  if(version!==forumRenderVersion||currentRoute!=='/forum')return;
  if(postId)renderForumDetail(data.post);else renderForumList(data,category);
 }catch(error){if(version===forumRenderVersion&&currentRoute==='/forum'){blankCanvas.innerHTML=`<div class="forum-empty" role="alert"><p>${escapeText(error.message)}</p><a href="#/forum">返回论坛</a><button class="small-button" id="forum-retry">重新读取</button></div>`;document.querySelector('#forum-retry').onclick=()=>renderForum(location.hash.slice(1));}}
}
function forumMeta(post){return `<span class="forum-category">${escapeText(post.category)}</span><span>${escapeText(post.author)}</span><time datetime="${escapeText(post.createdAt)}">${escapeText(forumTime(post.createdAt))}</time>`;}
function renderForumList(data,category){
 const pageLink=n=>`#/forum?category=${encodeURIComponent(category)}&page=${n}`;
 blankCanvas.innerHTML=`<div class="forum-intro"><p>聊赛事、谈选手，也一起看懂冰上的技术。</p><button class="forum-primary" id="forum-new">发布讨论 ↗</button></div><nav class="forum-categories" aria-label="讨论分类">${[['all','全部'],...FORUM_CATEGORIES.map(c=>[c,c])].map(([id,label])=>`<a href="#/forum?category=${encodeURIComponent(id)}" ${id===category?'aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="forum-post-list">${data.posts.length?data.posts.map(post=>`<article class="forum-post-row"><div><h2><a href="#/forum?post=${escapeText(post._id)}">${escapeText(post.title)}</a></h2><div class="forum-meta">${forumMeta(post)}</div></div><a class="forum-comment-count" href="#/forum?post=${escapeText(post._id)}" aria-label="${post.commentCount} 条评论"><strong>${post.commentCount}</strong><span>评论</span></a></article>`).join(''):'<p class="forum-empty">还没有讨论，来发布第一篇吧。</p>'}</div>${data.total>data.pageSize?`<nav class="forum-pagination" aria-label="帖子分页">${data.page>1?`<a href="${pageLink(data.page-1)}">← 上一页</a>`:''}<span>第 ${data.page} / ${Math.ceil(data.total/data.pageSize)} 页</span>${data.page*data.pageSize<data.total?`<a href="${pageLink(data.page+1)}">下一页 →</a>`:''}</nav>`:''}`;
 document.querySelector('#forum-new').onclick=()=>authUser?location.hash='/forum?view=new':forumLogin();
}
function renderForumCompose(){
 if(!authUser){forumLogin();return;}
 blankCanvas.innerHTML=`<a class="forum-back" href="#/forum">← 返回讨论列表</a><form class="forum-form" id="forum-post-form"><h2>发布讨论</h2><label for="forum-title">标题</label><input id="forum-title" name="title" maxlength="100" required placeholder="你想和大家讨论什么？"><label for="forum-category">分类</label><select id="forum-category" name="category">${FORUM_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select><label for="forum-content">正文</label><textarea id="forum-content" name="content" rows="8" maxlength="2000" required placeholder="写下你的观点或问题…"></textarea><p class="forum-feedback" role="alert"></p><div class="forum-form-actions"><a href="#/forum">取消</a><button class="forum-primary" type="submit">发布讨论</button></div></form>`;
 const form=document.querySelector('#forum-post-form');
 form.onsubmit=async event=>{event.preventDefault();await submitForum(form,()=>apiRequest('/api/forum/posts',{method:'POST',body:JSON.stringify({title:form.elements.title.value,category:form.elements.category.value,content:form.elements.content.value})}),result=>{location.hash=`/forum?post=${result.id}`;});};
}
function renderForumDetail(post){
 blankCanvas.innerHTML=`<a class="forum-back" href="#/forum">← 返回讨论列表</a><article class="forum-article"><h2>${escapeText(post.title)}</h2><div class="forum-meta">${forumMeta(post)}</div><div class="forum-body">${escapeText(post.content)}</div></article><section class="forum-comments" aria-labelledby="forum-comments-title"><h2 id="forum-comments-title">评论 <span>${post.comments.length}</span></h2>${post.comments.length?post.comments.map(comment=>`<article class="forum-comment"><div class="forum-meta"><strong>${escapeText(comment.author)}</strong><time datetime="${escapeText(comment.createdAt)}">${escapeText(forumTime(comment.createdAt))}</time></div><p class="forum-body">${escapeText(comment.content)}</p></article>`).join(''):'<p class="forum-empty">暂无评论，欢迎分享你的看法。</p>'}<form id="forum-comment-form" class="forum-form"><label for="forum-comment">发表评论</label><textarea id="forum-comment" name="content" rows="3" maxlength="1000" placeholder="${authUser?'分享你的看法…':'登录后参与讨论'}" ${authUser?'required':'readonly'}></textarea><p class="forum-feedback" role="alert"></p><button class="forum-primary" type="${authUser?'submit':'button'}" id="forum-comment-submit">${authUser?'发表评论':'登录后评论'}</button></form></section>`;
 const form=document.querySelector('#forum-comment-form');
 if(!authUser){document.querySelector('#forum-comment-submit').onclick=forumLogin;document.querySelector('#forum-comment').onclick=forumLogin;return;}
 form.onsubmit=async event=>{event.preventDefault();await submitForum(form,()=>apiRequest(`/api/forum/posts/${encodeURIComponent(post._id)}/comments`,{method:'POST',body:JSON.stringify({content:form.elements.content.value})}),async()=>{await renderForum(location.hash.slice(1));document.querySelector('#forum-comments-title')?.scrollIntoView({block:'start'});});};
}
async function submitForum(form,request,onSuccess){
 if(form.dataset.busy)return;if(!form.reportValidity())return;
 const button=form.querySelector('button[type="submit"]'),feedback=form.querySelector('.forum-feedback');
 form.dataset.busy='true';button.disabled=true;feedback.textContent='';
 try{await onSuccess(await request());}catch(error){feedback.textContent=error.message;if(error.status===401){authUser=null;updateAuthUI();forumLogin();}}finally{delete form.dataset.busy;button.disabled=false;}
}
