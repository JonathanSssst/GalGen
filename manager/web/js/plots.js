/* 剧情编辑器页面（对话/选项/分支树）。 */

/* ---------- Alpine 组件：对话表单 ---------- */
function galgenDialogForm() {
  const s = App.data.scripts.find((x) => x.id === App.cur.scriptId);
  const d = s ? s.dialogs.find((x) => x.id === App.cur.dialogId) : null;
  const chars = App.data.characters || [];
  const _opt = (list, labelFn, current, placeholder) => {
    let h = placeholder !== undefined ? `<option value="">${placeholder}</option>` : '';
    for (const it of list) {
      const sel = String(it.id) === String(current) ? ' selected' : '';
      h += `<option value="${esc(it.id)}"${sel}>${esc(labelFn(it))}</option>`;
    }
    return h;
  };
  return {
    d,
    chars,
    scenes: App.data.scenes || [],
    assets: App.data.assets || [],
    get currentChar() {
      return this.chars.find((x) => x.id === (this.d && this.d.character_id)) || null;
    },
    get standees() { return this.assets.filter((a) => a.category === 'standee'); },
    get voices() { return this.assets.filter((a) => a.category === 'voice'); },
    get charOptionsHtml() { return _opt(this.chars, (c) => c.name, this.d.character_id, '（旁白）'); },
    get speakerLabelOptionsHtml() {
      const c = this.currentChar;
      if (!c) return '<option value="">（无角色）</option>';
      const labels = Array.isArray(c.labels) ? c.labels : [];
      let h = `<option value="">${esc(c.name)}（角色名）</option>`;
      for (const l of labels) {
        h += `<option value="${esc(l)}"${l === this.d.speaker_label ? ' selected' : ''}>${esc(l)}</option>`;
      }
      return h;
    },
    // 立绘：有角色时仅显示当前角色的立绘；旁白（无角色）可用全部立绘
    get standeeOptionsHtml() {
      const c = this.currentChar;
      const charAssetIds = c ? (c.standees || []).map((st) => st.asset_id) : null;
      const list = charAssetIds ? this.standees.filter((a) => charAssetIds.includes(a.id)) : this.standees;
      return _opt(list, (a) => `${a.file_name} (${a.id})`, this.d.standee, '（无）');
    },
    get voiceOptionsHtml() { return _opt(this.voices, (a) => `${a.file_name} (${a.id})`, this.d.voice, '（无）'); },
    get sceneOptionsHtml() { return _opt(this.scenes, (s2) => s2.name, this.d.scene_id, '（无）'); },
    commit() { commit(); },
    updateListItem() { App.Pages.plots.updateDialogListItem(); },
    onTypeChange() {
      if (this.d.type === 'choice' && !this.d.options) this.d.options = [];
      commit();
      App.Pages.plots.renderTabs();
    },
  };
}

/* ---------- Alpine 组件：选项编辑器 ---------- */
function galgenOptionEditor() {
  const s = App.data.scripts.find((x) => x.id === App.cur.scriptId);
  const d = s ? s.dialogs.find((x) => x.id === App.cur.dialogId) : null;
  const optIdx = App.cur.optionIdx || 0;
  const realOpt = d ? d.options[optIdx] : null;
  const opt = realOpt ? JSON.parse(JSON.stringify(realOpt)) : null;
  const _opt = (list, valueKey, labelFn, current, placeholder) => {
    let h = placeholder !== undefined ? `<option value="">${placeholder}</option>` : '';
    for (const it of list) {
      const v = typeof it === 'string' ? it : it[valueKey];
      const label = typeof it === 'string' ? it : labelFn(it);
      const sel = String(v) === String(current) ? ' selected' : '';
      h += `<option value="${esc(v)}"${sel}>${esc(label)}</option>`;
    }
    return h;
  };
  const functions = App.data.functions || [];
  return {
    opt,
    functions,
    get actionOptionsHtml() {
      return _opt(this.functions, 'id', (f) => `${f.name} (${f.id})`, this.opt.action_id, '（不指向函数）');
    },
    save() {
      Object.assign(realOpt, this.opt);
      commit();
      closeModal();
      App.Pages.plots.renderTabs();
    },
    cancel() { closeModal(); },
  };
}

App.Pages.plots = {
  render(host) {
    if (!App.cur.plotTab) App.cur.plotTab = 'form';
    host.innerHTML = `
    <div class="hsplit">
      <div class="side" style="width:240px;min-width:240px;">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">剧情 <span class="sub">${(App.data.scripts || []).length} 条</span></div>
          <div class="hint" style="margin-bottom:6px;">拖动 ⠿ 排序；勾选多选；Ctrl+点击多选</div>
          <div class="list" id="plots-scripts"></div>
          <div class="toolbar">
            <button class="btn btn-primary" id="plot-script-add">+ 新建</button>
            <button class="btn btn-danger" id="plot-script-del">删除</button>
          </div>
          <div class="toolbar">
            <button class="btn" id="dlg-copy">复制</button>
            <button class="btn" id="dlg-up">上移</button>
            <button class="btn" id="dlg-down">下移</button>
          </div>
          <button class="btn" id="plot-export" style="margin-top:8px;">导出剧情为 txt…</button>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main" style="min-width:0;">
        <div class="tabs" id="plot-tabs">
          <div class="tab${App.cur.plotTab === 'form' ? ' active' : ''}" data-tab="form">剧情设置</div>
          <div class="tab${App.cur.plotTab === 'options' ? ' active' : ''}${this.dialog() && this.dialog().type !== 'choice' ? ' disabled' : ''}" data-tab="options">选项编辑</div>
          <div class="tab${App.cur.plotTab === 'tree' ? ' active' : ''}" data-tab="tree">分支树</div>
        </div>
        <div id="plot-tab-content" class="panel" style="height:calc(100% - 46px);overflow:auto;"></div>
      </div>
    </div>`;

    host.querySelector('#plot-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (!t || t.classList.contains('disabled')) return;
      App.cur.plotTab = t.dataset.tab;
      this.renderTabs();
    });

    host.querySelector('#plot-script-add').addEventListener('click', () => this.newItem());
    host.querySelector('#dlg-copy').addEventListener('click', () => this.copyItem());
    host.querySelector('#dlg-up').addEventListener('click', () => this.moveItem(-1));
    host.querySelector('#dlg-down').addEventListener('click', () => this.moveItem(1));
    host.querySelector('#plot-script-del').addEventListener('click', () => this.deleteSelected());
    host.querySelector('#plot-export').addEventListener('click', async () => {
      await flushCommit();
      const s = this.script();
      if (!s) { toast('请先选择要导出的剧情。'); return; }
      const ok = await call('export_script', s.id);
      if (ok) toast('已导出');
    });

    this.updateScripts();
    this.renderTabs();
  },

  /* 新建：悬浮选择类型（文本/选项/音效/视频） */
  newItem() {
    const host = document.getElementById('page-host');
    const anchor = host.querySelector('#plot-script-add');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'type-menu';
    menu.style.cssText = `position:absolute;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:200;`;
    menu.innerHTML = `
      <div class="type-menu">
        <div class="type-menu-title">选择新建剧情类型</div>
        ${[['text', '文本'], ['choice', '选项'], ['sfx', '音效'], ['video', '视频']].map(([t, label]) => `
          <button class="btn type-menu-item" data-type="${t}">${label}</button>`).join('')}
      </div>`;
    host.appendChild(menu);
    const close = () => menu.remove();
    host.querySelectorAll('.type-menu-item').forEach((btn) => {
      btn.addEventListener('click', () => { close(); this.addUnit(btn.dataset.type); });
    });
    setTimeout(() => document.addEventListener('click', function(e) {
      if (!menu.contains(e.target) && e.target !== anchor) close();
    }), 0);
  },

  async addUnit(type) {
    await flushCommit();
    const id = await call('next_id', 'scripts');
    const chapter = this.script() ? this.script().chapter_id : (App.data.chapters[0]?.id || '');
    const d = { id: `${id}_d`, type, character_id: '', speaker_label: '', standee: '', expression: '', voice: '', scene_id: '', content: '', options: [], actions: [], sfx: [], video_asset_id: '', video_skippable: true };
    if (type !== 'choice') delete d.options;
    if (type !== 'text' && type !== 'choice') { d.character_id = ''; d.content = ''; }
    const script = { id, chapter_id: chapter, order: this.nextOrder(), dialogs: [d] };
    const cur = App.data.scripts.findIndex((x) => x.id === App.cur.scriptId);
    if (cur >= 0) App.data.scripts.splice(cur + 1, 0, script);
    else App.data.scripts.push(script);
    App.cur.scriptId = id;
    App.cur.dialogId = d.id;
    App.cur.plotTab = 'form';
    commit();
    this.updateScripts();
    this.renderTabs();
  },

  nextOrder() {
    const max = App.data.scripts.reduce((m, s) => Math.max(m, s.order || 0), 0);
    return max + 1;
  },

  copyItem() {
    const s = this.script();
    if (!s) return;
    const copy = JSON.parse(JSON.stringify(s));
    copy.id = copy.id + '_copy_' + String(Date.now()).slice(-4);
    copy.order = this.nextOrder();
    if (copy.dialogs[0]) copy.dialogs[0].id = `${copy.id}_d`;
    const cur = App.data.scripts.findIndex((x) => x.id === App.cur.scriptId);
    App.data.scripts.splice(cur + 1, 0, copy);
    App.cur.scriptId = copy.id;
    App.cur.dialogId = copy.dialogs[0] ? copy.dialogs[0].id : '';
    commit();
    this.updateScripts();
    this.renderTabs();
  },

  moveItem(delta) {
    const idx = App.data.scripts.findIndex((x) => x.id === App.cur.scriptId);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= App.data.scripts.length) return;
    const arr = App.data.scripts;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    arr.forEach((s, i) => { s.order = i; });
    commit();
    this.updateScripts();
  },

  deleteSelected() {
    const selSet = App.cur.scriptSel || new Set();
    let targets = [...selSet];
    if (!targets.length && App.cur.scriptId) targets = [App.cur.scriptId];
    if (!targets.length) { toast('请先勾选要删除的剧情'); return; }
    if (!confirm(`确定删除所选 ${targets.length} 条剧情？`)) return;
    App.data.scripts = App.data.scripts.filter((s) => !targets.includes(s.id));
    App.cur.scriptSel = new Set();
    const idx = App.data.scripts.findIndex((s) => s.id === App.cur.scriptId);
    App.cur.scriptId = App.data.scripts.length ? App.data.scripts[Math.min(Math.max(idx, 0), App.data.scripts.length - 1)].id : '';
    App.cur.dialogId = '';
    commit();
    this.updateScripts();
    this.renderTabs();
  },

  /* ---------- 状态 ---------- */

  script() { return App.data.scripts.find((s) => s.id === App.cur.scriptId) || null; },

  dialog() {
    const s = this.script();
    return s && s.dialogs && s.dialogs[0] ? s.dialogs[0] : null;
  },

  nextDialogId() {
    const s = this.script();
    let max = 0;
    (s.dialogs || []).forEach((d) => { const m = String(d.id).match(/_(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return `${s.id}_dlg_${String(max + 1).padStart(4, '0')}`;
  },

  nextOptionId(d) {
    let max = 0;
    (d.options || []).forEach((o) => { const m = String(o.id).match(/_(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return `${d.id}_opt_${String(max + 1).padStart(4, '0')}`;
  },

  /* ---------- 列表渲染 ---------- */

  typeLabel(t) {
    return ({ text: '文本', choice: '选项', sfx: '音效', video: '视频' })[t] || t;
  },

  updateScripts() {
    const el = document.getElementById('plots-scripts');
    if (!el) return;
    const selSet = App.cur.scriptSel || new Set();
    const items = [...(App.data.scripts || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    el.innerHTML = items.map((s) => {
      const d = s.dialogs && s.dialogs[0];
      const preview = d ? (d.speaker_label ? `${d.speaker_label}：` : '') + (d.content || (d.type === 'sfx' ? '音效' : d.type === 'video' ? '视频' : '')).slice(0, 20) : '空';
      return `
      <div class="list-item${s.id === App.cur.scriptId ? ' active' : ''}${selSet.has(s.id) ? ' multi-selected' : ''}" data-id="${esc(s.id)}">
        <input type="checkbox" class="multi-check" data-id="${esc(s.id)}"${selSet.has(s.id) ? ' checked' : ''} title="多选">
        <span class="drag-handle" title="拖动排序">⠿</span>
        <span class="tag type-${esc(d ? d.type : '')}">${esc(this.typeLabel(d ? d.type : ''))}</span>
        <span class="sub">${esc(preview)}</span>
      </div>`;
    }).join('') || '<div class="empty">暂无剧情</div>';
    el.querySelectorAll('.list-item').forEach((it) => {
      it.addEventListener('click', (e) => {
        if (e.target.closest('.multi-check')) return;
        if (e.ctrlKey || e.metaKey) {
          const sel = App.cur.scriptSel || new Set();
          if (sel.has(it.dataset.id)) sel.delete(it.dataset.id); else sel.add(it.dataset.id);
          App.cur.scriptSel = sel;
          this.updateScripts();
          return;
        }
        App.cur.scriptId = it.dataset.id;
        const s = App.data.scripts.find((x) => x.id === it.dataset.id);
        App.cur.dialogId = s && s.dialogs[0] ? s.dialogs[0].id : '';
        this.updateScripts();
        this.renderTabs();
      });
    });
    el.querySelectorAll('.multi-check').forEach((cb) => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const sel = App.cur.scriptSel || new Set();
        if (cb.checked) sel.add(cb.dataset.id); else sel.delete(cb.dataset.id);
        App.cur.scriptSel = sel;
        this.updateScripts();
      });
    });
    this.bindScriptSort();
  },

  bindScriptSort() {
    const el = document.getElementById('plots-scripts');
    if (!el) return;
    if (this._scriptSort) {
      if (this._scriptSort.el === el) return;
      this._scriptSort.destroy();
      this._scriptSort = null;
    }
    this._scriptSort = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      scroll: true,
      scrollSensitivity: 40,
      scrollSpeed: 20,
      bubbleScroll: true,
      onEnd: () => {
        const order = Array.from(el.querySelectorAll('.list-item')).map((it) => it.dataset.id);
        const byId = {};
        App.data.scripts.forEach((s) => { byId[s.id] = s; });
        App.data.scripts = order.map((id, i) => { const s = byId[id]; if (s) s.order = i; return s; }).filter(Boolean);
        commit();
        this.updateScripts();
      },
    });
  },

  /* ---------- 标签页 ---------- */

  renderTabs() {
    const host = document.getElementById('page-host');
    const tabs = host.querySelector('#plot-tabs');
    const content = host.querySelector('#plot-tab-content');
    if (!tabs || !content) return;
    tabs.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === App.cur.plotTab);
      t.classList.toggle('disabled', t.dataset.tab === 'options' && this.dialog() && this.dialog().type !== 'choice');
    });
    if (App.cur.plotTab === 'form') this.renderFormTab(content);
    else if (App.cur.plotTab === 'options') this.renderOptionsTab(content);
    else this.renderTreeTab(content);
  },

  renderFormTab(content) {
    const d = this.dialog();
    if (!d) { content.innerHTML = '<div class="empty">选择或新建一条剧情</div>'; return; }
    if (d.type === 'sfx') { this.renderSfxForm(content); return; }
    if (d.type === 'video') { this.renderVideoForm(content); return; }
    content.innerHTML = `
      <div x-data="galgenDialogForm()" class="field-grid">
        <label class="field"><span>类型</span>
          <select x-model="d.type" @change="onTypeChange()">
            <option value="text">文本</option>
            <option value="choice">选项</option>
            <option value="sfx">音效</option>
            <option value="video">视频</option>
          </select>
        </label>
        <label class="field"><span>ID</span><input class="input-lg" readonly x-model="d.id"></label>
        <label class="field"><span>角色</span>
          <select x-model="d.character_id" @change="commit()" x-html="charOptionsHtml"></select>
        </label>
        <label class="field"><span>说话者显示名</span>
          <select x-model="d.speaker_label" @change="commit()" x-html="speakerLabelOptionsHtml"></select>
          <span class="hint" style="margin-top:2px;display:block;">选「角色名（角色名）」即用角色名；其余为该角色「显示名」列表项</span>
        </label>
        <label class="field"><span>立绘</span>
          <select x-model="d.standee" @change="commit()" x-html="standeeOptionsHtml"></select>
          <span class="hint" style="margin-top:2px;display:block;">有角色时仅当前角色立绘；旁白可用全部</span>
        </label>
        <label class="field"><span>语音</span>
          <select x-model="d.voice" @change="commit()" x-html="voiceOptionsHtml"></select>
        </label>
        <label class="field"><span>场景</span>
          <select x-model="d.scene_id" @change="commit()" x-html="sceneOptionsHtml"></select>
        </label>
        <div class="field field-full"><span>功能（引用函数，可多个；函数在「函数」页管理）</span><div id="pf-actions"></div></div>
        <label class="field field-full"><span>对话内容（选项类型时此处为问题文本）</span>
          <textarea x-model="d.content" @input.debounce.500ms="commit(); updateListItem()"></textarea>
        </label>
      </div>`;
    this.bindActionsEditor(content, d);
  },

  /* 功能引用列表编辑器 */
  bindActionsEditor(container, d) {
    const box = container.querySelector('#pf-actions');
    if (!box) return;
    const fns = App.data.functions || [];
    const render = () => {
      box.innerHTML = '';
      (d.actions || []).forEach((fnId, i) => {
        const fn = fns.find((f) => f.id === fnId);
        const row = document.createElement('div');
        row.className = 'kv-row';
        const sel = document.createElement('select');
        sel.className = 'kv-val';
        sel.innerHTML = optionsHtml(fns, 'id', (f) => `${f.name} (${f.id})`, fnId, '（选择函数）');
        sel.addEventListener('change', () => { d.actions[i] = sel.value; commit(); });
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger kv-del';
        del.textContent = '×';
        del.addEventListener('click', () => { d.actions.splice(i, 1); commit(); render(); });
        row.appendChild(sel);
        row.appendChild(del);
        box.appendChild(row);
      });
      if (!d.actions || !d.actions.length) box.innerHTML = '<div class="hint">未引用函数</div>';
      const add = document.createElement('button');
      add.className = 'btn kv-add';
      add.textContent = '+ 添加功能';
      add.addEventListener('click', () => {
        if (!fns.length) { toast('请先在「函数」页创建函数'); return; }
        d.actions = d.actions || [];
        d.actions.push(fns[0].id);
        commit();
        render();
      });
      box.appendChild(add);
    };
    render();
  },

  renderSfxForm(content) {
    const d = this.dialog();
    content.innerHTML = `
      <div x-data="galgenDialogForm()" class="field-grid">
        <label class="field"><span>类型</span>
          <select x-model="d.type" @change="onTypeChange()">
            <option value="text">文本</option>
            <option value="choice">选项</option>
            <option value="sfx">音效</option>
            <option value="video">视频</option>
          </select>
        </label>
        <label class="field"><span>ID</span><input class="input-lg" readonly x-model="d.id"></label>
        <label class="field"><span>场景</span>
          <select x-model="d.scene_id" @change="commit()" x-html="sceneOptionsHtml"></select>
        </label>
        <div class="field field-full"><span>音效（纯音频；播放后按播放方式推进）</span><div id="sfx-list"></div></div>
      </div>`;
    this.bindSfxEditor(content, d);
  },

  bindSfxEditor(container, d) {
    const box = container.querySelector('#sfx-list');
    if (!box) return;
    const audioAssets = filterByCategory(App.data.assets, 'se');
    const render = () => {
      box.innerHTML = '';
      (d.sfx || []).forEach((sfx, i) => {
        const row = document.createElement('div');
        row.className = 'sfx-item';
        row.innerHTML = `
          <div class="kv-row">
            <select class="sfx-mode">
              <option value="play"${sfx.play_mode === 'play' ? ' selected' : ''}>播放（立即下一条）</option>
              <option value="play_and_wait"${sfx.play_mode === 'play_and_wait' ? ' selected' : ''}>播放并等待</option>
              <option value="loop_until"${sfx.play_mode === 'loop_until' ? ' selected' : ''}>循环直到指定剧情</option>
            </select>
            <select class="sfx-asset">${optionsHtml(audioAssets, 'id', (a) => `${a.file_name} (${a.id})`, sfx.asset_id, '（选择音效资产）')}</select>
            <button class="btn btn-sm btn-danger kv-del">×</button>
          </div>
          <div class="kv-row">
            <input class="sfx-fade-in" type="number" min="0" step="0.1" value="${sfx.fade_in ?? 0}" placeholder="淡入(秒)">
            <input class="sfx-fade-out" type="number" min="0" step="0.1" value="${sfx.fade_out ?? 0}" placeholder="淡出(秒)">
            <input class="sfx-rate" type="number" min="0.25" step="0.1" value="${sfx.rate ?? 1}" placeholder="倍速">
            <label class="sfx-exclusive" style="display:flex;align-items:center;gap:4px;white-space:nowrap;">
              <input type="checkbox" class="sfx-excl" ${sfx.exclusive === false ? '' : 'checked'}> 互斥
            </label>
          </div>
          <div class="kv-row" style="${sfx.play_mode === 'loop_until' ? '' : 'display:none'}">
            <select class="sfx-stop">${optionsHtml(App.data.scripts, 'id', (s) => `${s.id}`, sfx.stop_script_id, '（选择停止剧情）')}</select>
          </div>`;
        const mode = row.querySelector('.sfx-mode');
        const stopRow = row.querySelectorAll('.kv-row')[2];
        mode.addEventListener('change', () => {
          sfx.play_mode = mode.value;
          stopRow.style.display = mode.value === 'loop_until' ? '' : 'none';
          commit();
        });
        row.querySelector('.sfx-asset').addEventListener('change', (e) => { sfx.asset_id = e.target.value; commit(); });
        row.querySelector('.sfx-fade-in').addEventListener('input', (e) => { sfx.fade_in = parseFloat(e.target.value) || 0; commit(); });
        row.querySelector('.sfx-fade-out').addEventListener('input', (e) => { sfx.fade_out = parseFloat(e.target.value) || 0; commit(); });
        row.querySelector('.sfx-rate').addEventListener('input', (e) => { sfx.rate = parseFloat(e.target.value) || 1; commit(); });
        row.querySelector('.sfx-excl').addEventListener('change', (e) => { sfx.exclusive = e.target.checked; commit(); });
        row.querySelector('.sfx-stop').addEventListener('change', (e) => { sfx.stop_script_id = e.target.value; commit(); });
        row.querySelector('.kv-del').addEventListener('click', () => { d.sfx.splice(i, 1); commit(); render(); });
        box.appendChild(row);
      });
      const add = document.createElement('button');
      add.className = 'btn kv-add';
      add.textContent = '+ 添加音效';
      add.addEventListener('click', () => {
        d.sfx = d.sfx || [];
        d.sfx.push({ id: `sfx_${Date.now()}`, play_mode: 'play', asset_id: '', fade_in: 0, fade_out: 0, rate: 1, exclusive: true, stop_script_id: '' });
        commit();
        render();
      });
      box.appendChild(add);
    };
    render();
  },

  renderVideoForm(content) {
    const d = this.dialog();
    const videos = filterByCategory(App.data.assets, 'video');
    content.innerHTML = `
      <div x-data="galgenDialogForm()" class="field-grid">
        <label class="field"><span>类型</span>
          <select x-model="d.type" @change="onTypeChange()">
            <option value="text">文本</option>
            <option value="choice">选项</option>
            <option value="sfx">音效</option>
            <option value="video">视频</option>
          </select>
        </label>
        <label class="field"><span>ID</span><input class="input-lg" readonly x-model="d.id"></label>
        <label class="field"><span>场景</span>
          <select x-model="d.scene_id" @change="commit()" x-html="sceneOptionsHtml"></select>
        </label>
        <label class="field field-full"><span>视频（沉浸播放，隐藏对话区；播完自动下一条）</span>
          <div class="toolbar" style="margin-top:4px;">
            <select id="pf-video" class="kv-val">${optionsHtml(videos, 'id', (a) => `${a.file_name} (${a.id})`, d.video_asset_id, '（选择视频资产）')}</select>
            <button class="btn btn-sm" id="pf-video-upload">上传视频</button>
          </div>
        </label>
        <label class="field" style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="pf-video-skip" ${d.video_skippable === false ? '' : 'checked'} style="width:auto;transform:scale(1.2);">
          <span style="margin:0;">可点击跳过（默认勾选）</span>
        </label>
      </div>`;
    content.querySelector('#pf-video').addEventListener('change', (e) => { d.video_asset_id = e.target.value; commit(); });
    content.querySelector('#pf-video-skip').addEventListener('change', (e) => { d.video_skippable = e.target.checked; commit(); });
    content.querySelector('#pf-video-upload').addEventListener('click', async () => {
      await flushCommit();
      const asset = await call('upload_asset', 'video');
      if (!asset || asset.error) { if (asset && asset.error) toast(asset.error); return; }
      App.data.assets.push(asset);
      d.video_asset_id = asset.id;
      commit();
      const payload = await call('get_data');
      if (payload) { App.filePath = payload.file_path || App.filePath; }
      this.renderVideoForm(content);
    });
  },

  renderOptionsTab(content) {
    const d = this.dialog();
    if (!d) { content.innerHTML = '<div class="empty">选择一条对话</div>'; return; }
    if (d.type !== 'choice') { content.innerHTML = '<div class="empty">该对话为文本类型，无选项。</div>'; return; }
    const options = d.options || [];
    const fns = App.data.functions || [];
    content.innerHTML = `
      <table class="data sortable-table">
        <thead><tr><th style="width:28px"></th><th style="width:120px">ID</th><th>内容</th><th>指向函数</th><th></th></tr></thead>
        <tbody id="opt-tbody">
          ${options.map((o, i) => {
            const fn = o.action_id ? fns.find((f) => f.id === o.action_id) : null;
            return `<tr data-idx="${i}">
              <td class="drag-handle" title="拖动排序">⠿</td>
              <td><span class="table-id">${esc(o.id)}</span></td>
              <td class="opt-content">${esc(o.content) || '<span class="placeholder">（空选项）</span>'}</td>
              <td>${fn ? esc(fn.name) : '—'}</td>
              <td><button class="btn btn-sm opt-edit">编辑</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" class="empty">暂无选项</td></tr>'}
        </tbody>
      </table>
      <div class="toolbar">
        <button class="btn btn-primary" id="opt-add">+ 新增选项</button>
        <button class="btn btn-danger" id="opt-del">删除所选</button>
      </div>
      <div class="hint" style="margin-top:6px;">拖动 ⠿ 可调整选项顺序；选项行为通过「指向函数」配置。</div>`;
    content.querySelectorAll('.opt-edit').forEach((btn) => {
      btn.addEventListener('click', () => this.openOptionEditor(+btn.closest('tr').dataset.idx));
    });
    content.querySelector('#opt-add').addEventListener('click', () => {
      d.options.push({ id: this.nextOptionId(d), content: '', action_id: '' });
      commit();
      this.renderTabs();
      this.openOptionEditor(d.options.length - 1);
    });
    content.querySelector('#opt-del').addEventListener('click', () => {
      const row = content.querySelector('tr.selected');
      if (!row) { alert('请先点击选择表格中的一行。'); return; }
      d.options.splice(+row.dataset.idx, 1);
      commit();
      this.renderTabs();
    });
    content.querySelectorAll('tr[data-idx]').forEach((tr) => {
      tr.addEventListener('click', () => {
        content.querySelectorAll('tr.selected').forEach((x) => x.classList.remove('selected'));
        tr.classList.add('selected');
      });
    });
    this.bindOptionSort(content);
  },

  bindOptionSort(content) {
    const tbody = content.querySelector('#opt-tbody');
    if (!tbody) return;
    if (this._optSort) {
      if (this._optSort.el === tbody) return;
      this._optSort.destroy();
      this._optSort = null;
    }
    this._optSort = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const d = this.dialog();
        if (!d) return;
        const order = Array.from(tbody.querySelectorAll('tr[data-idx]')).map((tr) => +tr.dataset.idx);
        d.options = order.map((i) => d.options[i]).filter(Boolean);
        commit();
        this.renderTabs();
      },
    });
  },

  /* ---------- 选项编辑器（模态框） ---------- */

  openOptionEditor(idx) {
    const d = this.dialog();
    if (!d || !d.options || !d.options[idx]) return;
    App.cur.optionIdx = idx;
    const modal = openModal(`
      <div x-data="galgenOptionEditor()">
        <h3>编辑选项</h3>
        <label class="field"><span>ID</span><input class="input-lg" readonly x-model="opt.id"></label>
        <label class="field"><span>选项内容</span><input x-model="opt.content"></label>
        <label class="field"><span>指向函数（动作在「函数」页编辑）</span>
          <select x-model="opt.action_id" x-html="actionOptionsHtml"></select>
          <span class="hint" style="margin-top:2px;display:block;">函数可包含跳转/解锁/修改变量等动作；不选则无效果（本选项仅作文本）。</span>
        </label>
        <div class="divider"></div>
        <div class="toolbar" style="justify-content:flex-end;">
          <button class="btn" @click="cancel()">取消</button>
          <button class="btn btn-primary" @click="save()">确定</button>
        </div>
      </div>
    `);
  },

  /* ---------- 分支树 ---------- */

  renderTreeTab(content) {
    const s = this.script();
    if (!s) { content.innerHTML = '<div class="empty">选择或新建剧情</div>'; return; }
    // 折叠状态持久化（切换对话后重渲染仍保持）
    const collapsed = this._treeCollapsed || new Set();
    this._treeCollapsed = collapsed;

    const renderNode = (d, depth) => {
      const isChoice = d.type === 'choice';
      const hasKids = isChoice && (d.options || []).length > 0;
      const isOpen = !collapsed.has(d.id);
      const active = d.id === App.cur.dialogId;
      const arrow = hasKids ? `<span class="tree-arrow${isOpen ? '' : ' closed'}">▾</span>` : '<span class="tree-arrow-placeholder"></span>';
      const kids = (hasKids && isOpen)
        ? `<ul class="tree-children">${(d.options || []).map((o) => {
            const desc = [];
            if (o.jump_to) desc.push(`跳转 ${o.jump_to}`);
            if (o.ending_id) desc.push(`结局 ${o.ending_id}`);
            (o.effects || []).forEach((e) => desc.push(`${e.target}.${e.variable}${e.operation}${e.value}`));
            if (o.unlock_cg) desc.push('解锁CG');
            if (o.unlock_script) desc.push('解锁剧情');
            return `<li class="tree-option" data-opt="${esc(o.id)}">
              <span class="tree-opt-icon">→</span>
              <span class="tree-opt-text">${esc(o.content || '(空)')}</span>
              <span class="branch-desc">${desc.length ? esc(desc.join('；')) : '对话结束'}</span>
            </li>`;
          }).join('')}</ul>`
        : '';
      return `<li class="tree-node${isChoice ? ' is-choice' : ''}${active ? ' active' : ''}" data-dialog="${esc(d.id)}">
        ${arrow}<span class="node${isChoice ? ' choice' : ''}"><span class="tag">${isChoice ? '选项' : '文本'}</span>${esc(d.id)}</span>
        <span class="branch-desc">${esc((d.content || '').slice(0, 30))}</span>
        ${kids}
      </li>`;
    };

    content.innerHTML = `<div class="hint" style="margin-bottom:10px;">点击▾折叠/展开选项节点；点击对话节点可在对话列表中定位。</div>
      <ul class="tree">${s.dialogs.map((d) => renderNode(d, 0)).join('') || '<li class="empty">暂无对话</li>'}</ul>`;

    content.querySelectorAll('.tree-node[data-dialog]').forEach((li) => {
      li.addEventListener('click', (e) => {
        const toggle = e.target.closest('.tree-arrow');
        const dialogId = li.dataset.dialog;
        if (toggle) {
          const d = s.dialogs.find((x) => x.id === dialogId);
          if (d && d.type === 'choice' && (d.options || []).length) {
            if (collapsed.has(dialogId)) collapsed.delete(dialogId); else collapsed.add(dialogId);
            this.renderTreeTab(content);
            return;
          }
        }
        // 点击节点 → 定位到该剧情并切到表单
        App.cur.scriptId = dialogId;
        App.cur.dialogId = this.script() && this.script().dialogs[0] ? this.script().dialogs[0].id : '';
        App.cur.plotTab = 'form';
        this.updateScripts();
        this.renderTabs();
      });
    });
  },

  updateDialogListItem() {
    const d = this.dialog();
    const el = document.getElementById('plots-scripts');
    if (!d || !el) return;
    const it = el.querySelector(`.list-item[data-id="${CSS.escape(App.cur.scriptId)}"]`);
    if (it) {
      const sub = it.querySelector('.sub');
      if (sub) sub.textContent = (d.speaker_label ? `${d.speaker_label}：` : '') + (d.content || '').slice(0, 20);
    }
  },
};
