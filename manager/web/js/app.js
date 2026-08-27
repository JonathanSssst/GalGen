/* GalGen 管理器前端核心：状态管理、导航、项目生命周期、页面注册。 */

const App = {
  data: null,          // {project, characters, scenes, chapters, scripts, assets, endings}
  meta: null,
  filePath: '',
  dirty: false,
  page: 'characters',
  cur: { scriptId: '', dialogId: '', characterId: '', sceneId: '', chapterId: '', assetId: '', endingId: '' },
  Pages: {},
  els: {},
};

/* ------------------------- 工具函数 ------------------------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toast(msg, ms = 2500) {
  const st = document.getElementById('status');
  st.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { st.textContent = ''; }, ms);
}

async function call(name, ...args) {
  if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api[name] !== 'function') {
    throw new Error('后端 API 不可用');
  }
  return await window.pywebview.api[name](...args);
}

function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-mask"><div class="modal">${html}</div></div>`;
  return root.querySelector('.modal');
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function optionsHtml(items, valueKey, labelFn, selected, placeholder) {
  let html = placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '';
  for (const it of items || []) {
    const v = typeof it === 'string' ? it : it[valueKey];
    const label = typeof it === 'string' ? it : labelFn(it);
    const sel = String(v) === String(selected) ? ' selected' : '';
    html += `<option value="${esc(v)}"${sel}>${esc(label)}</option>`;
  }
  return html;
}

function filterByCategory(items, category) {
  return (items || []).filter((a) => !category || a.category === category);
}

/* ------------------------- 项目状态 ------------------------- */

function applyPayload(payload) {
  if (!payload || payload.error) {
    toast('项目加载失败');
    return;
  }
  App.data = payload.data;
  App.meta = payload.meta;
  App.filePath = payload.file_path || '';
  App.dirty = !!payload.dirty;
  updateHeader();
  renderPage();
}

function commit() {
  if (!App.data) return;
  App.dirty = true;
  call('set_data', App.data);
  updateHeader();
}

async function saveProject() {
  const ok = await call('save_project');
  if (ok) {
    App.dirty = false;
    const payload = await call('get_data');
    if (payload) {
      App.filePath = payload.file_path || '';
      App.data = payload.data;
    }
    updateHeader();
    toast('已保存');
  }
}

async function newProject() {
  if (!confirmDiscard()) return;
  const payload = await call('new_project');
  if (payload) applyPayload(payload);
}

async function openProject() {
  if (!confirmDiscard()) return;
  const payload = await call('open_project');
  if (payload) applyPayload(payload);
}

async function saveProjectAs() {
  const ok = await call('save_project_as');
  if (ok) {
    App.dirty = false;
    const payload = await call('get_data');
    if (payload) {
      App.filePath = payload.file_path || '';
      App.data = payload.data;
    }
    updateHeader();
    toast('已另存为');
  }
}

function confirmDiscard() {
  if (!App.dirty) return true;
  return confirm('当前项目有未保存的更改，继续将丢失这些更改。是否继续？');
}

function updateHeader() {
  const title = App.data?.project?.name || '未命名项目';
  document.getElementById('project-title').innerHTML =
    `${esc(title)}${App.filePath ? `<span class="path">${esc(App.filePath)}</span>` : ''}` +
    (App.dirty ? ' <span style="color:#e67e22">●</span>' : '');
  document.title = `${title} - GalGen 管理器`;
  call('set_window_title', `${title}${App.dirty ? ' ●' : ''} - GalGen 管理器`);
}

function updateStatus(msg) {
  document.getElementById('status').textContent = msg || '';
}

/* ------------------------- 页面切换 ------------------------- */

function renderPage() {
  const page = App.Pages[App.page];
  const host = document.getElementById('page-host');
  if (!page) { host.innerHTML = '<div class="empty">页面不存在</div>'; return; }
  page.render(host, App);
  page.after?.(host, App);
}

function switchPage(name) {
  App.page = name;
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === name);
  });
  renderPage();
}

/* ------------------------- 初始化 ------------------------- */

async function ensureProject() {
  let payload = null;
  try {
    const last = await call('get_last_project');
    if (last) {
      payload = await call('load_path', last);
      if (payload?.error) payload = null;
    }
  } catch (e) { /* 忽略 */ }
  if (!payload) {
    payload = await call('new_project');
  }
  applyPayload(payload);
}

function bindGlobal() {
  if (App._bound) return;
  App._bound = true;
  document.getElementById('nav').addEventListener('click', (e) => {
    const a = e.target.closest('.nav-item');
    if (a) switchPage(a.dataset.page);
  });

  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-new').addEventListener('click', newProject);
  document.getElementById('btn-open').addEventListener('click', openProject);
  document.getElementById('btn-save-as').addEventListener('click', saveProjectAs);
  document.getElementById('btn-validate').addEventListener('click', async () => {
    const issues = await call('validate');
    switchPage('build');
    App.Pages.build.renderValidation(issues);
  });

  window.addEventListener('beforeunload', (e) => {
    if (App.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
    else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newProject(); }
    else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openProject(); }
  });
}

async function initApp() {
  if (App._init) return;
  App._init = true;
  bindGlobal();
  await ensureProject();
  renderPage();
}

window.addEventListener('pywebviewready', initApp);

// 兜底：若 pywebviewready 已触发或缺失
if (window.pywebview?.ready) {
  initApp();
}
