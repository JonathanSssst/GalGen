/* GalGen 游戏端引擎
 * 阶段 3：基础阅读系统 + 分支选项系统
 * 阶段 4：存档/读档、画廊、音乐室、剧本回想、设置、标题主菜单、结局统计
 */

const G = {
  data: null,
  script: null,
  idx: 0,
  variables: {},
  globals: {},
  readSet: new Set(),          // 键：scriptId:dialogId
  seenEndings: [],
  unlockedCg: [],
  unlockedScripts: [],
  unlockedBgm: [],
  phase: 'idle',               // idle | reading | options | ending
  typingDone: false,
  typeTimer: null,
  wasRead: false,
  autoOn: false,
  skipOn: false,
  cfg: { speed: 30, autoDelay: 3, font: '微软雅黑', fontSize: 22, bgmVolume: 80, seVolume: 80, voiceVolume: 100 },
  optionIndex: 0,
  audio: { bgm: null, bgmId: '', voice: null },
  choicePoints: [],
  menuFrom: 'title',           // title | ingame
};

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function src(assetId) {
  return (G.data && G.data._asset_map && G.data._asset_map[assetId]) || '';
}

function charById(id) {
  return (G.data.characters || []).find((c) => c.id === id);
}

function resolveStandee(d, char) {
  let id = d.standee;
  if (!id && char) id = char.default_standee;
  return id ? src(id) : '';
}

function keyOf(d) {
  return `${G.script.id}:${d.id}`;
}

/* ------------------------- 配置与进度持久化 ------------------------- */

function loadCfg() {
  const def = (G.data && G.data.project && G.data.project.defaults) || {};
  const defaults = {
    speed: def.text_speed ?? 30,
    autoDelay: def.auto_advance_delay ?? 3,
    font: def.font_cn || def.font || '微软雅黑',
    fontEn: def.font_en || '',
    fontSize: def.font_size ?? 22,
  };
  Object.assign(G.cfg, defaults);
  try { Object.assign(G.cfg, JSON.parse(localStorage.getItem('galgen_cfg') || '{}')); } catch (e) { /* 忽略 */ }
}

function saveCfg() {
  localStorage.setItem('galgen_cfg', JSON.stringify(G.cfg));
  applyVolumes();
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem('galgen_progress') || '{}');
    G.seenEndings = p.seenEndings || [];
    G.unlockedCg = p.unlockedCg || [];
    G.unlockedScripts = p.unlockedScripts || [];
    G.unlockedBgm = p.unlockedBgm || [];
    G.readSet = new Set();
    const rm = p.readMap || {};
    Object.keys(rm).forEach((sid) => (rm[sid] || []).forEach((did) => G.readSet.add(`${sid}:${did}`)));
  } catch (e) { /* 忽略 */ }
}

function persistProgress() {
  const readMap = {};
  G.readSet.forEach((k) => {
    const [sid, did] = k.split(':');
    (readMap[sid] = readMap[sid] || []).push(did);
  });
  localStorage.setItem('galgen_progress', JSON.stringify({
    seenEndings: G.seenEndings,
    unlockedCg: G.unlockedCg,
    unlockedScripts: G.unlockedScripts,
    unlockedBgm: G.unlockedBgm,
    readMap,
  }));
}

function unlockBgm(assetId) {
  if (assetId && !G.unlockedBgm.includes(assetId)) {
    G.unlockedBgm.push(assetId);
    persistProgress();
  }
}

/* ------------------------- 音频 ------------------------- */

function applyVolumes() {
  if (G.audio.bgm) G.audio.bgm.volume = (G.cfg.bgmVolume || 0) / 100;
  if (G.audio.voice) G.audio.voice.volume = (G.cfg.voiceVolume || 0) / 100;
}

function setBgm(assetId) {
  if (G.audio.bgmId === assetId) return;
  if (G.audio.bgm) { G.audio.bgm.pause(); G.audio.bgm = null; }
  G.audio.bgmId = assetId;
  if (assetId) {
    const url = src(assetId);
    if (url) {
      const a = new Audio(url);
      a.loop = true;
      a.volume = (G.cfg.bgmVolume || 0) / 100;
      a.play().catch(() => { /* 忽略自动播放限制 */ });
      G.audio.bgm = a;
    }
  }
}

function playVoice(assetId) {
  if (!assetId) return;
  const url = src(assetId);
  if (!url) return;
  const a = new Audio(url);
  a.volume = (G.cfg.voiceVolume || 0) / 100;
  a.play().catch(() => { /* 忽略 */ });
  G.audio.voice = a;
}

function stopAllAudio() {
  if (G.audio.bgm) { G.audio.bgm.pause(); G.audio.bgm = null; }
  G.audio.bgmId = '';
}

/* ------------------------- 初始化 ------------------------- */

async function init() {
  loadCfg();
  loadProgress();
  const res = await fetch('data.json');
  G.data = await res.json();
  const name = G.data._project_name || 'GalGen';
  document.title = `${name} - 游戏`;
  $('project-name').textContent = name;
  $('sel-speed').value = String(G.cfg.speed);
  applyFont();
  applyVolumes();
  bindEvents();
  showTitle();
}

function findStartScript() {
  const chapters = [...(G.data.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  if (chapters.length && chapters[0].start_script) return chapters[0].start_script;
  return (G.data.scripts || [])[0]?.id || null;
}

function applyFont() {
  const cn = G.cfg.font || '微软雅黑';
  const en = G.cfg.fontEn || 'Microsoft YaHei';
  document.body.style.fontFamily = `"${cn}", "${en}", "Microsoft YaHei UI", sans-serif`;
  $('dialog-text').style.fontSize = `${G.cfg.fontSize}px`;
}

/* ------------------------- 遮罩 / 屏幕 ------------------------- */

function showOverlay(html) {
  $('overlay-card').innerHTML = html;
  $('overlay').classList.remove('hidden');
}

function hideOverlay() {
  $('overlay').classList.add('hidden');
}

function backToMenu() {
  if (G.menuFrom === 'ingame') showInGameMenu();
  else showTitle();
}

/* ==================== 标题主菜单 ==================== */

function showTitle() {
  G.menuFrom = 'title';
  G.phase = 'idle';
  G.script = null;
  stopAllAudio();
  const hasContinue = !!latestSave();
  showOverlay(`
    <h1>${esc(G.data._project_name || 'GalGen')}</h1>
    ${G.data.project && G.data.project.description ? `<div class="desc">${esc(G.data.project.description)}</div>` : ''}
    <div class="menu-list">
      <button class="menu-btn primary-btn" id="t-new">新游戏</button>
      <button class="menu-btn" id="t-continue"${hasContinue ? '' : ' disabled'}>继续游戏</button>
      <button class="menu-btn" id="t-load">加载存档</button>
      <button class="menu-btn" id="t-appreciate">鉴赏模式</button>
      <button class="menu-btn" id="t-settings">设置</button>
      <button class="menu-btn" id="t-endings">结局统计</button>
      <button class="menu-btn" id="t-quit">退出游戏</button>
    </div>`);
  $('t-new').addEventListener('click', startGame);
  $('t-continue').addEventListener('click', () => { const s = latestSave(); if (s) { hideOverlay(); loadSaveData(s); } });
  $('t-load').addEventListener('click', () => showSlotScreen('load'));
  $('t-appreciate').addEventListener('click', () => showAppreciateMenu());
  $('t-settings').addEventListener('click', () => showSettings());
  $('t-endings').addEventListener('click', () => showEndings());
  $('t-quit').addEventListener('click', () => window.pywebview.api.quit());
}

function showAppreciateMenu() {
  showOverlay(`
    <h3>鉴赏模式</h3>
    <div class="menu-list">
      <button class="menu-btn" id="ap-gallery">画廊（CG 回想）</button>
      <button class="menu-btn" id="ap-music">音乐室</button>
      <button class="menu-btn" id="ap-recall">剧本回想</button>
      <button class="menu-btn" id="ap-hidden">隐藏剧情</button>
      <button class="menu-btn" id="ap-back">返回</button>
    </div>`);
  $('ap-gallery').addEventListener('click', () => showGallery());
  $('ap-music').addEventListener('click', () => showMusic());
  $('ap-recall').addEventListener('click', () => showRecall());
  $('ap-hidden').addEventListener('click', () => showHidden());
  $('ap-back').addEventListener('click', backToMenu);
}

/* ==================== 隐藏剧情 ==================== */

function showHidden() {
  const unlocked = (G.unlockedScripts || []).map((id) => (G.data.scripts || []).find((s) => s.id === id)).filter(Boolean);
  showOverlay(`
    <h3>隐藏剧情</h3>
    ${unlocked.length ? `
      <ul class="music-list">
        ${unlocked.map((s) => `
          <li class="music-item" data-id="${esc(s.id)}">
            <span class="music-name">${esc(s.id)}（${(s.dialogs || []).length} 条对话）</span>
            <button class="ctrl hidden-play">播放</button>
          </li>`).join('')}
      </ul>`
      : '<div class="empty">暂无解锁的隐藏剧情。\n触发包含「解锁隐藏剧情」的选项后即可在此播放。</div>'}
    <div class="toolbar center"><button class="primary-btn" id="hid-back">返回</button></div>`);
  $('hid-back').addEventListener('click', backToMenu);
  document.querySelectorAll('.hidden-play').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.music-item').dataset.id;
      hideOverlay();
      playScript(id);
    });
  });
}

/* ==================== 新游戏 / 读档 ==================== */

function startGame() {
  G.variables = {};
  G.data.characters.forEach((c) => { G.variables[c.id] = { ...(c.variables || {}) }; });
  G.globals = {};
  G.script = null;
  G.choicePoints = [];
  hideOverlay();
  playScript(findStartScript());
}

function playScript(id) {
  G.script = (G.data.scripts || []).find((s) => s.id === id) || null;
  if (!G.script) { showScriptEnd('项目中没有可播放的剧情。'); return; }
  G.idx = 0;
  showDialog(0);
}

/* ==================== 存档 / 读档 ==================== */

function saveKey(slot) {
  return slot === 'q' ? 'galgen_quick' : `galgen_save_${slot}`;
}

function captureSnapshot() {
  try {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#14171e';
    ctx.fillRect(0, 0, 320, 180);
    const bg = $('bg');
    if (bg && bg.src) { try { ctx.drawImage(bg, 0, 0, 320, 180); } catch (e) { /* 忽略 */ } }
    const st = $('standee');
    if (st && st.src && st.style.display !== 'none') {
      try { ctx.drawImage(st, 80, 20, 160, 130); } catch (e) { /* 忽略 */ }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 140, 320, 40);
    return c.toDataURL('image/jpeg', 0.6);
  } catch (e) {
    return '';
  }
}

function doSave(slot) {
  const data = {
    scriptId: G.script ? G.script.id : null,
    idx: G.idx,
    variables: G.variables,
    globals: G.globals,
    readSet: [...G.readSet],
    seenEndings: G.seenEndings,
    unlockedCg: G.unlockedCg,
    unlockedScripts: G.unlockedScripts,
    unlockedBgm: G.unlockedBgm,
    snapshot: captureSnapshot(),
    ts: Date.now(),
    label: G.script ? G.script.id : '标题',
  };
  localStorage.setItem(saveKey(slot), JSON.stringify(data));
  toast(slot === 'q' ? '已快速存档' : `已存档到槽位 ${Number(slot) + 1}`);
}

function readSave(slot) {
  try {
    return JSON.parse(localStorage.getItem(saveKey(slot)) || 'null');
  } catch (e) {
    return null;
  }
}

function latestSave() {
  const slots = [0, 1, 2, 'q'];
  let best = null;
  slots.forEach((s) => {
    const d = readSave(s);
    if (d && (!best || d.ts > best.ts)) best = d;
  });
  return best;
}

function loadSaveData(data) {
  G.script = null;
  G.variables = data.variables || {};
  G.globals = data.globals || {};
  G.readSet = new Set(data.readSet || []);
  G.seenEndings = data.seenEndings || G.seenEndings;
  G.unlockedCg = data.unlockedCg || G.unlockedCg;
  G.unlockedScripts = data.unlockedScripts || G.unlockedScripts;
  G.unlockedBgm = data.unlockedBgm || G.unlockedBgm;
  G.choicePoints = [];
  persistProgress();
  if (data.scriptId) {
    G.script = (G.data.scripts || []).find((s) => s.id === data.scriptId) || null;
    if (G.script) {
      G.idx = data.idx || 0;
      showDialog(G.idx);
      return;
    }
  }
  showTitle();
}

function slotSnapshotHtml(d, slotLabel) {
  const time = d ? new Date(d.ts).toLocaleString() : '';
  return `
    <div class="save-slot${d ? '' : ' empty'}" data-slot="${slotLabel}">
      ${d && d.snapshot ? `<img src="${d.snapshot}" alt="预览">` : '<div class="slot-empty">空</div>'}
      <div class="slot-info">
        <b>${d ? esc(d.label || d.scriptId || '存档') : '空槽位'}</b>
        <span>${d ? esc(time) : ''}</span>
      </div>
    </div>`;
}

function showSlotScreen(mode) {
  const slots = [0, 1, 2];
  showOverlay(`
    <h3>${mode === 'save' ? '存档' : '读档'}</h3>
    <div class="slot-grid">
      ${slots.map((s) => slotSnapshotHtml(readSave(s), String(s))).join('')}
      ${slotSnapshotHtml(readSave('q'), 'q')}
    </div>
    <div class="toolbar center">
      <button class="primary-btn" id="slot-back">返回</button>
    </div>`);
  $('slot-back').addEventListener('click', backToMenu);
  document.querySelectorAll('.save-slot').forEach((el) => {
    el.addEventListener('click', () => {
      const s = el.dataset.slot;
      if (mode === 'save') {
        if (G.phase === 'idle') { toast('当前不在游戏中，无法存档'); return; }
        doSave(s === 'q' ? 'q' : Number(s));
        backToMenu();
      } else {
        const d = readSave(s === 'q' ? 'q' : Number(s));
        if (!d) { toast('该槽位为空'); return; }
        hideOverlay();
        loadSaveData(d);
      }
    });
  });
}

function returnToChoicePoint() {
  const cp = G.choicePoints.pop();
  if (!cp) { toast('没有可返回的选择点'); return; }
  G.variables = cp.variables;
  G.globals = cp.globals;
  G.script = (G.data.scripts || []).find((s) => s.id === cp.scriptId) || G.script;
  if (G.script) { G.idx = cp.idx; hideOverlay(); showDialog(cp.idx); }
}

/* ==================== 游戏内菜单 ==================== */

function showInGameMenu() {
  G.menuFrom = 'ingame';
  showOverlay(`
    <h3>菜单</h3>
    <div class="menu-list">
      <button class="menu-btn primary-btn" id="m-continue">继续游戏</button>
      <button class="menu-btn" id="m-save">存档</button>
      <button class="menu-btn" id="m-load">读档</button>
      <button class="menu-btn" id="m-quick">快速存档</button>
      <button class="menu-btn" id="m-choice">返回上一个选择点</button>
      <button class="menu-btn" id="m-settings">设置</button>
      <button class="menu-btn" id="m-title">回到标题</button>
    </div>`);
  $('m-continue').addEventListener('click', hideOverlay);
  $('m-save').addEventListener('click', () => showSlotScreen('save'));
  $('m-load').addEventListener('click', () => showSlotScreen('load'));
  $('m-quick').addEventListener('click', () => { doSave('q'); backToMenu(); });
  $('m-choice').addEventListener('click', returnToChoicePoint);
  $('m-settings').addEventListener('click', () => showSettings());
  $('m-title').addEventListener('click', () => { hideOverlay(); showTitle(); });
}

/* ==================== 画廊 / 音乐室 / 剧本回想 ==================== */

function showGallery() {
  const cgs = (G.data.assets || []).filter((a) => a.category === 'cg');
  showOverlay(`
    <h3>画廊</h3>
    ${cgs.length ? `
      <div class="gallery-grid">
        ${cgs.map((a) => {
          const got = G.unlockedCg.includes(a.id);
          return got
            ? `<div class="cg-card"><img src="${src(a.id)}" alt="${esc(a.file_name)}" title="${esc(a.file_name)}"><span class="cg-label">${esc(a.file_name)}</span></div>`
            : `<div class="cg-card locked"><div class="cg-lock">🔒</div><span class="cg-label">未解锁</span></div>`;
        }).join('')}
      </div>`
      : '<div class="empty">项目中还没有 CG 资产。</div>'}
    <div class="toolbar center"><button class="primary-btn" id="gal-back">返回</button></div>`);
  $('gal-back').addEventListener('click', backToMenu);
  document.querySelectorAll('.cg-card:not(.locked)').forEach((el) => {
    el.addEventListener('click', () => {
      showOverlay(`<div class="cg-view"><img src="${el.querySelector('img').src}" alt=""><div class="toolbar center"><button class="primary-btn" id="cg-close">关闭</button></div></div>`);
      $('cg-close').addEventListener('click', showGallery);
    });
  });
}

function showMusic() {
  const bgms = (G.data.assets || []).filter((a) => a.category === 'bgm');
  let playingId = '';
  showOverlay(`
    <h3>音乐室</h3>
    ${bgms.length ? `
      <ul class="music-list">
        ${bgms.map((a) => `
          <li class="music-item${G.unlockedBgm.includes(a.id) ? '' : ' locked'}" data-id="${esc(a.id)}">
            <span class="music-name">${G.unlockedBgm.includes(a.id) ? esc(a.file_name) : '🔒 未解锁'}</span>
            ${G.unlockedBgm.includes(a.id) ? '<button class="ctrl music-play">播放</button>' : ''}
          </li>`).join('')}
      </ul>`
      : '<div class="empty">项目中还没有 BGM 资产。</div>'}
    <div class="toolbar center"><button class="primary-btn" id="mus-back">返回</button></div>`);
  $('mus-back').addEventListener('click', () => { stopAllAudio(); backToMenu(); });
  document.querySelectorAll('.music-play').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.music-item').dataset.id;
      if (playingId === id) {
        stopAllAudio();
        btn.textContent = '播放';
        playingId = '';
        return;
      }
      stopAllAudio();
      const a = new Audio(src(id));
      a.loop = false;
      a.volume = (G.cfg.bgmVolume || 0) / 100;
      a.play().catch(() => {});
      G.audio.bgm = a;
      playingId = id;
      document.querySelectorAll('.music-play').forEach((b) => { b.textContent = '播放'; });
      btn.textContent = '停止';
    });
  });
}

function showRecall() {
  const scripts = G.data.scripts || [];
  showOverlay(`
    <h3>剧本回想</h3>
    ${scripts.length ? `
      <ul class="music-list">
        ${scripts.map((s) => {
          const read = [...G.readSet].filter((k) => k.startsWith(`${s.id}:`));
          return `<li class="music-item recall-item" data-script="${esc(s.id)}">
            <span class="music-name">${esc(s.id)} <span class="hint">（已读 ${read.length}/${(s.dialogs || []).length} 条）</span></span>
            <button class="ctrl recall-view">查看</button>
          </li>`;
        }).join('')}
      </ul>`
      : '<div class="empty">项目中还没有剧情。</div>'}
    <div class="toolbar center"><button class="primary-btn" id="rec-back">返回</button></div>`);
  $('rec-back').addEventListener('click', backToMenu);
  document.querySelectorAll('.recall-view').forEach((btn) => {
    btn.addEventListener('click', () => showRecallScript(btn.closest('.recall-item').dataset.script));
  });
}

function showRecallScript(scriptId) {
  const s = (G.data.scripts || []).find((x) => x.id === scriptId);
  if (!s) return;
  const rows = (s.dialogs || []).map((d) => {
    const read = G.readSet.has(`${s.id}:${d.id}`);
    const char = charById(d.character_id);
    const speaker = d.speaker_label || (char ? char.name : '旁白');
    const head = `${d.type === 'choice' ? '【选项】' : '【文本】'} ${esc(speaker)}`;
    return `<li class="recall-dialog${read ? '' : ' unread'}"><span class="recall-head">${head}</span><span class="recall-body">${esc(d.content || '')}</span></li>`;
  }).join('');
  showOverlay(`
    <h3>${esc(s.id)}</h3>
    <ul class="recall-list">${rows || '<li class="empty">该剧情没有对话</li>'}</ul>
    <div class="hint" style="margin-top:8px;">未读过的对话显示为半透明。</div>
    <div class="toolbar center"><button class="primary-btn" id="rec-s-back">返回</button></div>`);
  $('rec-s-back').addEventListener('click', showRecall);
}

/* ==================== 设置 ==================== */

function showSettings() {
  const c = G.cfg;
  showOverlay(`
    <h3>设置</h3>
    <div class="settings-list">
      <div class="set-row"><span>文字速度</span>
        <select id="set-speed">
          <option value="15"${c.speed === 15 ? ' selected' : ''}>慢</option>
          <option value="30"${c.speed === 30 ? ' selected' : ''}>中</option>
          <option value="60"${c.speed === 60 ? ' selected' : ''}>快</option>
          <option value="120"${c.speed === 120 ? ' selected' : ''}>超快</option>
        </select></div>
      <div class="set-row"><span>自动阅读等待（秒）</span>
        <input type="number" id="set-auto" value="${c.autoDelay}" min="0.5" max="60" step="0.5"></div>
      <div class="set-row"><span>BGM 音量</span><input type="range" id="set-bgm" min="0" max="100" value="${c.bgmVolume}"><em class="vol">${c.bgmVolume}%</em></div>
      <div class="set-row"><span>SE 音量</span><input type="range" id="set-se" min="0" max="100" value="${c.seVolume}"><em class="vol">${c.seVolume}%</em></div>
      <div class="set-row"><span>语音音量</span><input type="range" id="set-voice" min="0" max="100" value="${c.voiceVolume}"><em class="vol">${c.voiceVolume}%</em></div>
      <div class="set-row"><span>窗口 / 全屏</span><button class="ctrl" id="set-full">切换全屏</button></div>
      <div class="set-row"><span>重置游戏</span><button class="ctrl danger" id="set-reset">清除全部进度</button></div>
    </div>
    <div class="toolbar center"><button class="primary-btn" id="set-back">返回</button></div>`);

  $('set-speed').addEventListener('change', (e) => { c.speed = parseInt(e.target.value, 10) || 30; saveCfg(); });
  $('set-auto').addEventListener('change', (e) => { c.autoDelay = parseFloat(e.target.value) || 3; saveCfg(); });
  const bindVol = (sel, key) => $(sel).addEventListener('input', (e) => {
    c[key] = parseInt(e.target.value, 10) || 0;
    document.querySelector(sel).nextElementSibling.textContent = c[key] + '%';
    saveCfg();
  });
  bindVol('set-bgm', 'bgmVolume');
  bindVol('set-se', 'seVolume');
  bindVol('set-voice', 'voiceVolume');
  $('set-full').addEventListener('click', () => window.pywebview.api.toggle_fullscreen());
  $('set-reset').addEventListener('click', () => {
    if (!confirm('确定清除全部存档进度与解锁记录？')) return;
    [0, 1, 2].forEach((s) => localStorage.removeItem(saveKey(s)));
    localStorage.removeItem(saveKey('q'));
    localStorage.removeItem('galgen_progress');
    loadProgress();
    toast('已重置进度');
    backToMenu();
  });
  $('set-back').addEventListener('click', backToMenu);
}

/* ==================== 结局统计 ==================== */

function showEndings() {
  const endings = G.data.endings || [];
  const got = endings.filter((e) => G.seenEndings.includes(e.id));
  showOverlay(`
    <h3>结局统计</h3>
    ${endings.length ? `
      <div class="endings-grid">
        ${endings.map((e) => {
          const seen = G.seenEndings.includes(e.id);
          return `<div class="ending-card${seen ? '' : ' locked'}">
            <b>${esc(e.name)}</b>
            <span>${seen ? esc(e.ending_type) : '🔒 未收集'}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="hint" style="margin-top:10px;">已收集 ${got.length}/${endings.length}</div>`
      : '<div class="empty">项目中还没有结局。</div>'}
    <div class="toolbar center"><button class="primary-btn" id="end-back">返回</button></div>`);
  $('end-back').addEventListener('click', backToMenu);
}

/* ------------------------- 剧情推进 ------------------------- */

function showDialog(i) {
  const d = G.script.dialogs[i];
  if (!d) { endScript(); return; }
  G.idx = i;
  G.typingDone = false;
  G.wasRead = G.readSet.has(keyOf(d));

  const scene = (G.data.scenes || []).find((s) => s.id === d.scene_id);
  $('bg').src = scene ? src(scene.background) : '';

  const char = charById(d.character_id);
  const speaker = d.speaker_label || (char ? char.name : '旁白');
  const standeeUrl = resolveStandee(d, char);
  const st = $('standee');
  if (standeeUrl) { st.src = standeeUrl; st.style.display = 'block'; } else { st.style.display = 'none'; }
  $('name-label').textContent = speaker;

  setBgm(d.bgm);
  playVoice(d.voice);

  hideOptions();
  G.phase = 'reading';
  typeText($('dialog-text'), d.content || '', () => {
    G.typingDone = true;
    G.readSet.add(keyOf(d));
    unlockBgm(d.bgm);
    persistProgress();
    if (d.type === 'choice') { showOptions(d); return; }
    maybeAuto();
  });
}

function typeText(el, text, onDone) {
  clearTimeout(G.typeTimer);
  el.textContent = '';
  if (G.skipOn && G.wasRead) {
    el.textContent = text;
    onDone();
    return;
  }
  if (G.skipOn && !G.wasRead) {
    G.skipOn = false;
    $('btn-skip').classList.remove('on');
  }
  const cps = G.cfg.speed > 0 ? G.cfg.speed : 30;
  const delay = 1000 / cps;
  let i = 0;
  function step() {
    i += 1;
    el.textContent = text.slice(0, i);
    if (i < text.length) G.typeTimer = setTimeout(step, delay);
    else onDone();
  }
  step();
}

function completeTyping() {
  clearTimeout(G.typeTimer);
  const d = G.script.dialogs[G.idx];
  $('dialog-text').textContent = d.content || '';
  G.typingDone = true;
  G.readSet.add(keyOf(d));
  unlockBgm(d.bgm);
  persistProgress();
  if (d.type === 'choice') showOptions(d);
}

function advance() {
  if (G.phase === 'idle' || G.phase === 'ending') return;
  if (!G.typingDone) { completeTyping(); return; }
  if (G.phase === 'options') return;
  const next = G.idx + 1;
  if (next < G.script.dialogs.length) showDialog(next);
  else endScript();
}

function maybeAuto() {
  if (G.skipOn && !G.wasRead) {
    G.skipOn = false;
    $('btn-skip').classList.remove('on');
    return;
  }
  if (G.autoOn) setTimeout(advance, G.cfg.autoDelay * 1000);
  else if (G.skipOn) setTimeout(advance, 90);
}

/* ------------------------- 选项系统 ------------------------- */

function hideOptions() {
  $('options').innerHTML = '';
}

function showOptions(d) {
  G.phase = 'options';
  G.optionIndex = 0;
  G.choicePoints.push({
    scriptId: G.script.id,
    idx: G.idx,
    variables: JSON.parse(JSON.stringify(G.variables)),
    globals: JSON.parse(JSON.stringify(G.globals)),
  });
  if (G.choicePoints.length > 20) G.choicePoints.shift();

  const box = $('options');
  box.innerHTML = '';
  (d.options || []).forEach((o, i) => {
    const btn = document.createElement('div');
    btn.className = 'option';
    btn.textContent = o.content || '(空)';
    btn.addEventListener('mouseenter', () => {
      G.optionIndex = i;
      renderOptionHighlight();
    });
    btn.addEventListener('click', () => selectOption(i));
    box.appendChild(btn);
  });
  renderOptionHighlight();
}

function renderOptionHighlight() {
  const opts = $('options').querySelectorAll('.option');
  opts.forEach((o, i) => o.classList.toggle('hl', i === G.optionIndex));
}

function selectOption(i) {
  const d = G.script.dialogs[G.idx];
  const opt = d.options[i];
  if (!opt) return;
  hideOptions();
  applyEffects(opt.effects);

  const msgs = [];
  if (opt.unlock_cg && !G.unlockedCg.includes(opt.unlock_cg)) {
    G.unlockedCg.push(opt.unlock_cg);
    msgs.push('解锁 CG');
  }
  if (opt.unlock_script && !G.unlockedScripts.includes(opt.unlock_script)) {
    G.unlockedScripts.push(opt.unlock_script);
    msgs.push('解锁隐藏剧情');
  }
  if (msgs.length) { persistProgress(); toast(msgs.join('、')); }

  if (opt.ending_id) { endGame(opt.ending_id); return; }
  if (opt.jump_to) {
    const idx = G.script.dialogs.findIndex((x) => x.id === opt.jump_to);
    if (idx >= 0) { showDialog(idx); return; }
    // 跨脚本跳转
    if ((G.data.scripts || []).some((s) => s.id === opt.jump_to)) {
      playScript(opt.jump_to);
      return;
    }
  }
  // 解锁的隐藏剧情：未显式跳转时播放它
  if (opt.unlock_script && (G.data.scripts || []).some((s) => s.id === opt.unlock_script)) {
    playScript(opt.unlock_script);
    return;
  }
  endScript();
}

function applyEffects(effects) {
  (effects || []).forEach((e) => {
    const store = e.target === 'global' ? G.globals : G.variables[e.target];
    if (!store) return;
    const cur = Number(store[e.variable]) || 0;
    const v = Number(e.value) || 0;
    if (e.operation === 'add') store[e.variable] = cur + v;
    else if (e.operation === 'sub') store[e.variable] = cur - v;
    else store[e.variable] = v;
  });
}

/* ------------------------- 分支条件判定 ------------------------- */

function resolveVar(name) {
  const n = String(name).trim();
  if (n.includes('.')) {
    const [cid, vn] = n.split('.');
    const ch = G.variables[cid];
    return ch ? Number(ch[vn]) || 0 : 0;
  }
  if (n in G.globals) return Number(G.globals[n]) || 0;
  for (const cid in G.variables) {
    const v = G.variables[cid];
    if (n in v) return Number(v[n]) || 0;
  }
  return 0;
}

function evalCondition(cond) {
  const c = String(cond || '').trim();
  if (!c) return true;
  const m = c.match(/^([\w.\u4e00-\u9fa5]+)\s*(>=|<=|>|<|==|!=)\s*(-?\d+)$/);
  if (!m) return false;
  const value = resolveVar(m[1]);
  const target = parseFloat(m[3]);
  switch (m[2]) {
    case '>=': return value >= target;
    case '<=': return value <= target;
    case '>': return value > target;
    case '<': return value < target;
    case '==': return value === target;
    case '!=': return value !== target;
    default: return false;
  }
}

function evaluateChapterEnding() {
  if (!G.script) return null;
  const chapter = (G.data.chapters || []).find((c) => c.id === G.script.chapter_id);
  if (!chapter || !(chapter.branches || []).length) return null;
  for (const br of chapter.branches) {
    if (br.ending_id && evalCondition(br.condition)) return br.ending_id;
  }
  return null;
}

/* ------------------------- 结束 / 结局 ------------------------- */

function showScriptEnd(msg) {
  G.phase = 'ending';
  stopAllAudio();
  showOverlay(`
    <h1>本段剧情结束</h1>
    <div class="desc">${esc(msg || '')}</div>
    <div class="menu-list">
      <button class="menu-btn primary-btn" id="e-continue">回到标题</button>
      <button class="menu-btn" id="e-save">在此存档</button>
    </div>`);
  $('e-continue').addEventListener('click', () => { hideOverlay(); showTitle(); });
  $('e-save').addEventListener('click', () => showSlotScreen('save'));
}

function endScript() {
  const endingId = evaluateChapterEnding();
  if (endingId) { endGame(endingId); return; }
  const nextId = nextChapterScript();
  if (nextId) { playScript(nextId); return; }
  showScriptEnd();
}

function nextChapterScript() {
  if (!G.script) return null;
  const chapters = G.data.chapters || [];
  const current = chapters.find((c) => c.id === G.script.chapter_id);
  if (!current) return null;
  const order = current.order || 0;
  const next = chapters
    .filter((c) => (c.order || 0) > order)
    .sort((a, b) => (a.order || 0) - (b.order || 0))[0];
  return next && next.start_script ? next.start_script : null;
}

function endGame(endingId) {
  const e = (G.data.endings || []).find((x) => x.id === endingId);
  G.phase = 'ending';
  stopAllAudio();
  if (e && !G.seenEndings.includes(e.id)) {
    G.seenEndings.push(e.id);
    persistProgress();
  }
  const name = e ? e.name : endingId;
  const desc = e ? e.description : '';
  const cg = e && e.cg ? src(e.cg) : '';
  showOverlay(`
    <h1>${esc(name)}</h1>
    ${cg ? `<img src="${cg}" alt="结局CG">` : ''}
    ${desc ? `<div class="desc">${esc(desc)}</div>` : ''}
    <div class="menu-list">
      <button class="menu-btn primary-btn" id="end-restart">回到标题</button>
      <button class="menu-btn" id="end-save">在此存档</button>
    </div>`);
  $('end-restart').addEventListener('click', () => { hideOverlay(); showTitle(); });
  $('end-save').addEventListener('click', () => showSlotScreen('save'));
}

/* ------------------------- 控制 ------------------------- */

function toggleAuto() {
  G.autoOn = !G.autoOn;
  $('btn-auto').classList.toggle('on', G.autoOn);
  if (G.autoOn && G.typingDone && G.phase === 'reading') maybeAuto();
}

function toggleSkip() {
  G.skipOn = !G.skipOn;
  $('btn-skip').classList.toggle('on', G.skipOn);
  if (G.skipOn && G.typingDone && G.phase === 'reading') maybeAuto();
}

const FONT_SIZES = [18, 22, 26, 32];

function cycleFontSize() {
  const i = FONT_SIZES.indexOf(G.cfg.fontSize);
  G.cfg.fontSize = FONT_SIZES[(i + 1) % FONT_SIZES.length];
  saveCfg();
  applyFont();
  toast(`字号：${G.cfg.fontSize}px`);
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ------------------------- 事件 ------------------------- */

function bindEvents() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.option')) return;
    if (e.target.closest('#overlay')) return;
    if (e.target.closest('.controls')) return;
    advance();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('overlay').classList.contains('hidden') && G.menuFrom === 'title') return;
      if ($('overlay').classList.contains('hidden')) showInGameMenu();
      else hideOverlay();
      return;
    }
    if (e.key === 'F5') { e.preventDefault(); if (G.phase === 'reading' || G.phase === 'options') doSave('q'); return; }
    if (e.key === 'F8') { e.preventDefault(); const d = readSave('q'); if (d) { hideOverlay(); loadSaveData(d); } return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (G.phase === 'options') {
        e.preventDefault();
        const n = G.script.dialogs[G.idx].options.length;
        G.optionIndex = (G.optionIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        renderOptionHighlight();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (G.phase === 'options') selectOption(G.optionIndex);
      else advance();
      return;
    }
    if (/^[1-9]$/.test(e.key) && G.phase === 'options') {
      const opts = G.script.dialogs[G.idx].options;
      if (parseInt(e.key, 10) <= opts.length) selectOption(parseInt(e.key, 10) - 1);
      return;
    }
    if (e.key.toLowerCase() === 'a') toggleAuto();
    if (e.key.toLowerCase() === 's') toggleSkip();
  });

  $('btn-menu').addEventListener('click', () => {
    if ($('overlay').classList.contains('hidden')) showInGameMenu();
    else hideOverlay();
  });
  $('btn-auto').addEventListener('click', toggleAuto);
  $('btn-skip').addEventListener('click', toggleSkip);
  $('btn-font').addEventListener('click', cycleFontSize);
  $('sel-speed').addEventListener('change', (e) => {
    G.cfg.speed = parseInt(e.target.value, 10) || 30;
    saveCfg();
  });
}

init();
