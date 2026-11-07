let authUser = null;
let authChecking = true;
let authRequestRunning = false;
const authChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ice-atlas-auth') : null;

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { 'Content-Type': 'application/json', 'X-Ice-Atlas': '1', ...options.headers } });
  } catch { throw new Error('无法连接网站服务，请通过 npm start 启动后访问本地网址。'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('账号服务尚未连接，请重启 Node.js 服务后刷新页面。'); }
  if (!response.ok) {
    const error = new Error(data.message || '操作未成功，请稍后重试。'); error.status = response.status; throw error;
  }
  return data;
}

function updateAuthUI() {
  const loggedIn = Boolean(authUser);
  document.querySelector('.guest-label').hidden = loggedIn;
  document.querySelector('.guest-label').lastChild.textContent = authChecking ? ' 正在连接' : ' 游客模式';
  document.querySelector('.login-link').hidden = loggedIn;
  document.querySelector('.register-link').hidden = loggedIn;
  const userArea = document.querySelector('#signed-in-actions');
  userArea.hidden = !loggedIn;
  document.querySelector('#account-nickname').textContent = authUser?.nickname || '';
  document.querySelector('#account-avatar').textContent = authUser?.nickname?.slice(0, 1) || '';
  const notice = document.querySelector('#forum-notice');
  notice.classList.toggle('is-signed-in', loggedIn);
  notice.querySelector('p').textContent = loggedIn ? `你好，${authUser.nickname}。你已登录，可参与论坛讨论。` : '你正在以游客身份浏览，登录后可发帖和回复。';
  notice.querySelector('a').hidden = loggedIn;
}

async function refreshAuth() {
  const previousId=authUser?.id;
  try { authUser = (await apiRequest('/api/auth/me')).user; }
  catch { authUser = null; }
  finally { authChecking = false; updateAuthUI();if(previousId!==authUser?.id&&currentRoute==='/forum')renderForum(location.hash.slice(1)); }
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#auth-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (authRequestRunning) return;
    const register = currentRoute === '/register';
    const feedback = document.querySelector('#auth-feedback');
    const password = document.querySelector('#password');
    const confirm = document.querySelector('#confirm-password');
    if (register && password.value !== confirm.value) { confirm.setCustomValidity('两次输入的密码不一致'); confirm.reportValidity(); return; }
    if (!form.reportValidity()) return;
    const payload = { email: document.querySelector('#email').value.trim(), password: password.value };
    if (register) payload.nickname = document.querySelector('#username').value.trim();
    const destination = new URLSearchParams(location.hash.split('?')[1] || '').get('next') === 'forum' ? '#/forum' : '#/';
    const submittedRoute = currentRoute;
    authRequestRunning = true;
    const button = document.querySelector('#auth-submit');
    button.disabled = true; form.setAttribute('aria-busy', 'true');
    button.textContent = register ? '正在注册…' : '正在登录…';
    feedback.textContent = ''; feedback.classList.remove('is-error');
    try {
      const result = await apiRequest(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(payload) });
      authUser = result.user; authChecking = false; updateAuthUI();
      authChannel?.postMessage('changed');
      form.reset();
      showNotice(result.message);
      if (currentRoute === submittedRoute) location.hash = destination;
    } catch (error) {
      if (currentRoute === submittedRoute) { feedback.textContent = error.message; feedback.classList.add('is-error'); }
    } finally {
      password.value = ''; confirm.value = ''; authRequestRunning = false;
      button.disabled = false; form.removeAttribute('aria-busy');
      button.innerHTML = `${currentRoute === '/register' ? '注册' : '登录'} <span aria-hidden="true">↗</span>`;
    }
  });
  document.querySelector('#logout-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
      authUser = null; updateAuthUI(); authChannel?.postMessage('changed'); showNotice('已退出登录，现在以游客身份浏览。');if(currentRoute==='/forum')renderForum(location.hash.slice(1));
    } catch (error) { showNotice(error.message, true); }
    finally { button.disabled = false; }
  });
  refreshAuth();
  authChannel?.addEventListener('message', refreshAuth);
  window.addEventListener('focus', refreshAuth);
});

let noticeTimer;
function showNotice(message, error = false) {
  const notice = document.querySelector('#account-notice');
  notice.textContent = message; notice.classList.toggle('is-error', error); notice.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}
