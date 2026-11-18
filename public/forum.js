const FORUM_CATEGORIES=['赛事讨论','选手交流','技术分析','自由交流'];
let forumRenderVersion=0;
let activeForumDraft;

function leaveForumCompose() {
  activeForumDraft?.close();
  activeForumDraft = undefined;
}
const forumTime=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false});
function forumLogin(){showNotice('请先登录后再参与讨论。');location.hash='/login?next=forum';}
async function renderForum(raw){
 leaveForumCompose();
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
function forumDeleteDialog(title, description, confirmLabel) {
  return `<dialog class="forum-delete-dialog" aria-labelledby="forum-delete-title" aria-describedby="forum-delete-description">
    <h2 id="forum-delete-title">${escapeText(title)}</h2>
    <p id="forum-delete-description">${escapeText(description)}</p>
    <p class="forum-feedback forum-delete-feedback" role="status" tabindex="-1"></p>
    <div class="forum-delete-actions"><button type="button" data-delete-cancel autofocus>取消</button><button type="button" data-delete-confirm>${escapeText(confirmLabel)}</button></div>
  </dialog>`;
}

function renderForumCompose(){
 if(!authUser){forumLogin();return;}
 blankCanvas.innerHTML=`<a class="forum-back" href="#/forum">← 返回讨论列表</a><form class="forum-form" id="forum-post-form"><h2>发布讨论</h2><div class="forum-draft-prompt" hidden><p></p><button type="button" data-draft-action="restore">恢复草稿</button><button type="button" data-draft-action="discard">放弃草稿</button></div><fieldset class="forum-compose-fields"><label for="forum-title">标题</label><input id="forum-title" name="title" maxlength="100" required placeholder="你想和大家讨论什么？"><label for="forum-category">分类</label><select id="forum-category" name="category">${FORUM_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select><label for="forum-content">正文</label><textarea id="forum-content" name="content" rows="8" maxlength="2000" required placeholder="写下你的观点或问题…"></textarea></fieldset><p class="forum-draft-status" role="status"></p><p class="forum-feedback" role="alert"></p><div class="forum-form-actions"><a href="#/forum">取消</a><button class="forum-primary" type="submit">发布讨论</button></div>${forumDeleteDialog('放弃这份草稿？', '放弃后，此浏览器中的草稿将被删除，且无法恢复。', '确认放弃')}</form>`;
 const form=document.querySelector('#forum-post-form');
 const userId = authUser.id;
 const draft = bindForumDraft(form, userId);
 activeForumDraft = draft;
 let uncertain = false;
 form.onsubmit = async event => {
   event.preventDefault();
   if (activeForumDraft !== draft || authUser?.id !== userId || draft.blocked) return;
   await submitForum(form, async () => {
     if (uncertain && !window.confirm('上一次发布结果未确认。请先到讨论列表核对。确定要再次提交吗？')) return null;
     draft.save();
     const fields = form.querySelector('fieldset');
     const body = JSON.stringify(forumDraftFields(form));
     fields.disabled = true;
     try {
       const result = await apiRequest('/api/forum/posts', {
         method: 'POST', body, signal: AbortSignal.timeout(20000)
       });
       if (!/^[a-f0-9]{24}$/i.test(result?.id || '')) throw new Error();
       draft.published();
       return result;
     } catch (error) {
       uncertain = !error.status || error.status === 408 || error.status >= 500;
       if (uncertain) throw new Error('无法确认帖子是否已发布。请返回讨论列表核对后再决定是否重试。');
       throw error;
     } finally {
       fields.disabled = false;
     }
   }, result => {
     if (result && activeForumDraft === draft && authUser?.id === userId) {
       location.hash = '/forum?post=' + result.id;
     }
   });
 };
}
function forumDraftFields(form) {
  const { title, content, category } = form.elements;
  return { title: title.value, content: content.value, category: category.value };
}

function validForumDraft(draft) {
  return draft && typeof draft.title === 'string' && draft.title.length <= 100
    && typeof draft.content === 'string' && draft.content.length <= 2000
    && FORUM_CATEGORIES.includes(draft.category)
    && Number.isSafeInteger(draft.updatedAt) && draft.updatedAt > 0 && draft.updatedAt <= 8640000000000000;
}

function bindForumDraft(form, userId) {
  const key = 'ice-atlas:forum-draft:v1:' + userId;
  const prompt = form.querySelector('.forum-draft-prompt');
  const status = form.querySelector('.forum-draft-status');
  const restore = prompt.querySelector('[data-draft-action="restore"]');
  const discard = prompt.querySelector('[data-draft-action="discard"]');
  const fields = form.querySelector('fieldset');
  const submit = form.querySelector('button[type="submit"]');
  const listeners = new AbortController();
  let stored, pending, dirty = false, finished = false;

  function feedback(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function setBlocked(blocked) {
    prompt.hidden = !blocked;
    fields.disabled = blocked;
    submit.disabled = blocked;
  }

  function save() {
    if (!dirty || !prompt.hidden || finished) return;
    feedback('正在保存…');
    try {
      const current = localStorage.getItem(key);
      // Another tab may have saved a newer draft while this editor was open.
      if (current !== (stored ?? null)) {
        feedback('草稿保存失败：本地有其他版本。请先复制当前内容，再重新打开编辑器。', 'error');
        return;
      }
      const draft = { ...forumDraftFields(form), updatedAt: Date.now() };
      if (!validForumDraft(draft)) throw new Error();
      if (draft.title.trim() || draft.content.trim() || draft.category !== FORUM_CATEGORIES[0]) {
        const next = JSON.stringify(draft);
        localStorage.setItem(key, next);
        stored = next;
        feedback('草稿已保存 · 当前浏览器');
      } else {
        if (stored) localStorage.removeItem(key);
        stored = null;
        feedback('');
      }
      dirty = false;
    } catch {
      feedback('草稿保存失败：请检查浏览器存储设置，或先复制内容。', 'error');
    }
  }

  try {
    stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        // 2100 input characters, each taking at most six JSON characters.
        const draft = stored.length <= 13000 ? JSON.parse(stored) : null;
        if (validForumDraft(draft)) pending = draft;
      } catch { /* Keep corrupt data until the user confirms discarding it. */ }
      setBlocked(true);
      restore.hidden = !pending;
      prompt.querySelector('p').textContent = pending
        ? '此浏览器有未发布的草稿，最近保存于 ' + forumTime(pending.updatedAt) + '。'
        : '草稿内容损坏，无法恢复。确认放弃后可开始编辑。';
      if (!pending) feedback('草稿读取失败。', 'error');
    }
  } catch {
    feedback('草稿读取失败：请检查浏览器存储设置。', 'error');
  }

  restore.onclick = () => {
    if (!pending || form.elements.title.value.trim() || form.elements.content.value.trim()
      || form.elements.category.value !== FORUM_CATEGORIES[0]) return;
    for (const name of ['title', 'content', 'category']) form.elements[name].value = pending[name];
    pending = null;
    setBlocked(false);
    feedback('草稿已恢复 · 当前浏览器');
    form.elements.title.focus();
  };
  const discardDialog = form.querySelector('.forum-delete-dialog');
  const cancelDiscard = discardDialog.querySelector('[data-delete-cancel]');
  const confirmDiscard = discardDialog.querySelector('[data-delete-confirm]');
  const discardFeedback = discardDialog.querySelector('.forum-delete-feedback');
  discard.onclick = () => {
    discardFeedback.textContent = '';
    discardDialog.showModal();
    cancelDiscard.focus();
  };
  cancelDiscard.onclick = () => discardDialog.close();
  discardDialog.onclose = () => {
    if (form.isConnected && !prompt.hidden && authUser?.id === userId) discard.focus();
  };
  confirmDiscard.onclick = () => {
    if (!discardDialog.open || authUser?.id !== userId) return;
    try {
      if (localStorage.getItem(key) !== stored) {
        discardFeedback.textContent = '草稿已在其他标签页更新。请重新打开发帖页。';
        return;
      }
      localStorage.removeItem(key);
      stored = pending = null;
      setBlocked(false);
      feedback('');
      discardDialog.close();
      form.elements.title.focus();
    } catch {
      discardFeedback.textContent = '草稿清理失败：请检查浏览器存储设置。';
    }
  };

  function onEdit(event) {
    if (!['title', 'content', 'category'].includes(event.target.name) || fields.disabled) return;
    dirty = true;
    save();
  }

  form.addEventListener('input', onEdit, { signal: listeners.signal });
  form.elements.category.addEventListener('change', onEdit, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); }, { signal: listeners.signal });
  window.addEventListener('pagehide', save, { signal: listeners.signal });

  return {
    get blocked() { return !prompt.hidden; },
    save,
    close() {
      save();
      if (discardDialog.open) discardDialog.close();
      listeners.abort();
    },
    published() {
      finished = true;
      dirty = false;
      try {
        if (stored && localStorage.getItem(key) === stored) localStorage.removeItem(key);
      } catch {
        showNotice('帖子已发布，但本地草稿清理失败。', true);
      }
    }
  };
}

document.addEventListener('click', event => {
 const menu = document.querySelector('.forum-post-menu[open]');
 if (menu && !menu.contains(event.target)) menu.open = false;
});

document.addEventListener('keydown', event => {
 if (event.key !== 'Escape') return;
 const menu = document.querySelector('.forum-post-menu[open]');
 if (!menu) return;
 event.preventDefault();
 menu.open = false;
 menu.querySelector('summary').focus();
});

window.addEventListener('hashchange', () => {
 document.querySelector('.forum-delete-dialog[open]')?.close();
 const menu = document.querySelector('.forum-post-menu[open]');
 if (menu) menu.open = false;
});

function bindForumDelete(postId, article) {
 const menu = article.querySelector('.forum-post-menu');
 const trigger = menu.querySelector('summary');
 const deleteItem = menu.querySelector('button');
 const confirmDialog = article.querySelector('.forum-delete-dialog');
 const cancel = confirmDialog.querySelector('[data-delete-cancel]');
 const confirm = confirmDialog.querySelector('[data-delete-confirm]');
 const feedback = confirmDialog.querySelector('.forum-delete-feedback');
 const userId = authUser.id;
 const detailHash = location.hash;
 let deleting = false;

 deleteItem.onclick = () => {
   if (confirmDialog.open || deleting || authUser?.id !== userId) return;
   menu.open = false;
   feedback.textContent = '';
   confirmDialog.showModal();
   cancel.focus();
 };
 cancel.onclick = () => confirmDialog.close();
 confirmDialog.oncancel = event => {
   if (deleting) event.preventDefault();
 };
 confirmDialog.onclose = () => {
   if (article.isConnected && location.hash === detailHash) trigger.focus();
 };
 confirm.onclick = async () => {
   if (!confirmDialog.open || deleting || authUser?.id !== userId) return;
   deleting = true;
   feedback.textContent = '正在删除…';
   feedback.focus();
   cancel.disabled = confirm.disabled = true;
   confirm.textContent = '正在删除…';
   try {
     const result = await apiRequest('/api/forum/posts/' + encodeURIComponent(postId), {
       method: 'DELETE', body: '{}', signal: AbortSignal.timeout(20000)
     });
     if (result?.deleted !== true) throw new Error();
     confirmDialog.close();
     if (article.isConnected && location.hash === detailHash) location.hash = '/forum';
   } catch (error) {
     feedback.textContent = !error.status || error.status === 408 || error.status >= 500
       ? '无法确认帖子是否已删除，请返回讨论列表核对。'
       : error.message;
   } finally {
     deleting = false;
     cancel.disabled = confirm.disabled = false;
     confirm.textContent = '确认删除';
   }
 };
}

function renderForumDetail(post){
 const canDelete = Boolean(authUser && post.isOwner === true);
 const menu = canDelete ? `<details class="forum-post-menu">
    <summary aria-label="帖子操作"><span aria-hidden="true">···</span></summary>
    <div class="forum-post-popover">
      <button type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>删除帖子</button>
    </div>
  </details>` : '';
 const confirmation = canDelete ? forumDeleteDialog(
   '删除这篇讨论？', '删除后，帖子及其评论将一并移除，且无法恢复。', '确认删除'
 ) : '';
 blankCanvas.innerHTML=`<a class="forum-back" href="#/forum">← 返回讨论列表</a><article class="forum-article"><div class="forum-article-heading"><h2>${escapeText(post.title)}</h2>${menu}</div><div class="forum-meta">${forumMeta(post)}</div><div class="forum-body">${escapeText(post.content)}</div>${confirmation}</article><section class="forum-comments" aria-labelledby="forum-comments-title"><h2 id="forum-comments-title">评论 <span>${post.comments.length}</span></h2>${post.comments.length?post.comments.map(comment=>`<article class="forum-comment"><div class="forum-meta"><strong>${escapeText(comment.author)}</strong><time datetime="${escapeText(comment.createdAt)}">${escapeText(forumTime(comment.createdAt))}</time></div><p class="forum-body">${escapeText(comment.content)}</p></article>`).join(''):'<p class="forum-empty">暂无评论，欢迎分享你的看法。</p>'}<form id="forum-comment-form" class="forum-form"><label for="forum-comment">发表评论</label><textarea id="forum-comment" name="content" rows="3" maxlength="1000" placeholder="${authUser?'分享你的看法…':'登录后参与讨论'}" ${authUser?'required':'readonly'}></textarea><p class="forum-feedback" role="alert"></p><button class="forum-primary" type="${authUser?'submit':'button'}" id="forum-comment-submit">${authUser?'发表评论':'登录后评论'}</button></form></section>`;
 if (canDelete) bindForumDelete(post._id, blankCanvas.querySelector('.forum-article'));
 const form=document.querySelector('#forum-comment-form');
 if(!authUser){document.querySelector('#forum-comment-submit').onclick=forumLogin;document.querySelector('#forum-comment').onclick=forumLogin;return;}
 form.onsubmit=async event=>{event.preventDefault();await submitForum(form,()=>apiRequest(`/api/forum/posts/${encodeURIComponent(post._id)}/comments`,{method:'POST',body:JSON.stringify({content:form.elements.content.value})}),async()=>{await renderForum(location.hash.slice(1));document.querySelector('#forum-comments-title')?.scrollIntoView({block:'start'});});};
}
async function submitForum(form,request,onSuccess){
 if(form.dataset.busy)return;if(!form.reportValidity())return;
 const button=form.querySelector('button[type="submit"]'),feedback=form.querySelector('.forum-feedback');
 form.dataset.busy='true';button.disabled=true;feedback.textContent='';
 try{await onSuccess(await request());}catch(error){feedback.textContent=error.message;if(error.status===401&&form.isConnected&&currentRoute==='/forum'){authUser=null;updateAuthUI();forumLogin();}}finally{delete form.dataset.busy;button.disabled=false;}
}
