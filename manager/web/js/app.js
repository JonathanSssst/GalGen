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
  aiVoices: null,
  _lastWinTitle: '',
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

/* 通用列表点击选中。selectFn(el, id) 设置选中项并渲染。 */
function listSelect(el, key, afterSelect) {
  el.addEventListener('click', (e) => {
    const it = e.target.closest('.list-item');
    if (!it) return;
    App.cur[key] = it.dataset.id;
    afterSelect && afterSelect(it.dataset.id);
  });
}

/* 删除后自动选中下一个（列表末尾则选前一个）。返回新选中 id 或 ''。 */
function nextAfterDelete(arr, curId) {
  if (!arr.length) return '';
  const idx = arr.findIndex((x) => x.id === curId);
  const next = Math.min(Math.max(idx, 0), arr.length - 1);
  return arr[next].id;
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
  resetAssetRefs();
  updateHeader();
  renderPage();
}

function commit() {
  if (!App.data) return;
  pushUndo();
  App.dirty = true;
  updateHeader();
  scheduleSync();
}

/* ------------------------- 撤销 / 重做（数据快照） ------------------------- */

const UNDO_LIMIT = 50;
let _undoStack = [];
let _redoStack = [];

function pushUndo() {
  if (!App.data) return;
  const snap = JSON.stringify(App.data);
  if (_undoStack.length && _undoStack[_undoStack.length - 1] === snap) return;
  _undoStack.push(snap);
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
  _redoStack = [];
}

function undo() {
  if (!App.data) return;
  const cur = JSON.stringify(App.data);
  if (_undoStack.length) {
    _redoStack.push(cur);
    if (_redoStack.length > UNDO_LIMIT) _redoStack.shift();
    App.data = JSON.parse(_undoStack.pop());
    resetAssetRefs();
    App.dirty = true;
    updateHeader();
    scheduleSync();
    renderPage();
    toast('已撤销');
  }
}

function redo() {
  if (!App.data) return;
  const cur = JSON.stringify(App.data);
  if (_redoStack.length) {
    _undoStack.push(cur);
    App.data = JSON.parse(_redoStack.pop());
    resetAssetRefs();
    App.dirty = true;
    updateHeader();
    scheduleSync();
    renderPage();
    toast('已重做');
  }
}

let _syncTimer = null;
let _syncPending = false;

function scheduleSync() {
  if (_syncPending) return;
  _syncPending = true;
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    _syncPending = false;
    try { await call('set_data', App.data); } catch (e) { /* 忽略 */ }
  }, 400);
}

function flushCommit() {
  if (!_syncPending) return Promise.resolve();
  clearTimeout(_syncTimer);
  _syncTimer = null;
  _syncPending = false;
  return call('set_data', App.data).catch(() => {});
}

async function saveProject() {
  await flushCommit();
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
  await flushCommit();
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
  const winTitle = `${title}${App.dirty ? ' ●' : ''} - GalGen 管理器`;
  if (winTitle !== App._lastWinTitle) {
    App._lastWinTitle = winTitle;
    call('set_window_title', winTitle);
  }
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
  bindSplitters(host);
}

function switchPage(name) {
  App.page = name;
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === name);
  });
  renderPage();
}

/* ------------------------- 功能区宽度拖拽调整 ------------------------- */

function bindSplitters(root) {
  if (!root) return;
  root.querySelectorAll('.vsplit-handle').forEach((handle) => {
    if (handle.dataset.bound) return;
    handle.dataset.bound = '1';
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const hsplit = handle.parentElement;
      const side = hsplit.querySelector('.side');
      if (!side) return;
      const startX = e.clientX;
      const startW = side.getBoundingClientRect().width;
      const move = (ev) => {
        const w = Math.max(140, Math.min(700, startW + (ev.clientX - startX)));
        side.style.width = w + 'px';
        side.style.minWidth = w + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  });
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
    await flushCommit();
    const issues = await call('validate');
    switchPage('build');
    App.Pages.build.renderValidation(issues);
  });

  window.addEventListener('beforeunload', (e) => {
    if (App.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); saveProject(); }
    else if (mod && k === 'n') { e.preventDefault(); newProject(); }
    else if (mod && k === 'o') { e.preventDefault(); openProject(); }
    else if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && k === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 'f') { e.preventDefault(); focusSearch(); }
  });
}

function focusSearch() {
  const inp = document.querySelector('input[kv-editor-search], #asset-cat');
  if (inp) { inp.focus(); inp.select(); }
  else toast('当前页面无可搜索输入框');
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
