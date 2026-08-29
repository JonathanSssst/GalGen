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
    get bgms() { return this.assets.filter((a) => a.category === 'bgm'); },
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
    get bgmOptionsHtml() { return _opt(this.bgms, (a) => `${a.file_name} (${a.id})`, this.d.bgm, '（无）'); },
    commit() { commit(); },
    updateListItem() { App.Pages.plots.updateDialogListItem(); },
    onTypeChange() {
      if (this.d.type === 'choice' && !this.d.options) this.d.options = [];
      commit();
      App.Pages.plots.updateDialogs();
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
  const chars = App.data.characters || [];
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
  const jumpOptions = [];
  (s.dialogs || []).forEach((x) => {
    jumpOptions.push({ v: x.id, label: `${x.id} · ${(x.content || '').slice(0, 14)}` });
  });
  (App.data.scripts || []).forEach((x) => {
    if (x.id !== s.id) jumpOptions.push({ v: x.id, label: `【剧情】${x.id}（${(x.dialogs || []).length} 条对话）` });
  });
  return {
    opt,
    chars,
    endings: App.data.endings || [],
    cgs: filterByCategory(App.data.assets, 'cg'),
    scripts: App.data.scripts || [],
    jumpOptions,
    get jumpOptionsHtml() { return _opt(this.jumpOptions, 'v', (x) => x.label, this.opt.jump_to, '（剧情结束）'); },
    get endingOptionsHtml() { return _opt(this.endings, 'id', (e) => `${e.name} (${e.id})`, this.opt.ending_id, '（无）'); },
    get cgOptionsHtml() { return _opt(this.cgs, 'id', (a) => `${a.file_name} (${a.id})`, this.opt.unlock_cg, '（无）'); },
    get scriptOptionsHtml() { return _opt(this.scripts, 'id', (x) => x.id, this.opt.unlock_script, '（无）'); },
    targetOptionsHtml(e) {
      let h = '<option value="">global（全局）</option>';
      for (const c of this.chars) {
        const sel = String(c.id) === String(e.target) ? ' selected' : '';
        h += `<option value="${esc(c.id)}"${sel}>${esc(c.name)}</option>`;
      }
      return h;
    },
    opOptionsHtml(e) {
      const ops = [['add', '＋ 增加'], ['sub', '－ 减少'], ['set', '＝ 设为']];
      let h = '';
      for (const [v, label] of ops) {
        h += `<option value="${v}"${v === e.operation ? ' selected' : ''}>${label}</option>`;
      }
      return h;
    },
    addEffect() {
      this.opt.effects.push({ target: '', variable: '', operation: 'add', value: 0 });
    },
    removeEffect(i) {
      this.opt.effects.splice(i, 1);
    },
    save() {
      this.opt.effects = this.opt.effects.filter((e) => e.variable && e.variable.trim());
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
      <div class="side" style="width:190px;min-width:190px;">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">剧情</div>
          <div class="list" id="plots-scripts"></div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="plot-script-add">新建剧情</button>
            <button class="btn btn-danger" id="plot-script-del">删除</button>
          </div>
          <button class="btn" id="plot-export" style="margin-top:8px;">导出剧情为 txt…</button>
        </div>
      </div>
      <div class="side" style="width:280px;min-width:280px;">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">对话</div>
          <div class="list" id="plots-dialogs"></div>
          <div class="toolbar">
            <button class="btn btn-primary" id="dlg-add-text">文本</button>
            <button class="btn btn-primary" id="dlg-add-choice">选项</button>
          </div>
          <div class="toolbar">
            <button class="btn" id="dlg-copy">复制</button>
            <button class="btn" id="dlg-up">上移</button>
            <button class="btn" id="dlg-down">下移</button>
            <button class="btn btn-danger" id="dlg-del">删除</button>
          </div>
          <div class="hint" style="margin-top:4px;">勾选多选，Ctrl+点击也可多选</div>
        </div>
      </div>
      <div class="main" style="min-width:0;">
        <div class="tabs" id="plot-tabs">
          <div class="tab${App.cur.plotTab === 'form' ? ' active' : ''}" data-tab="form">对话设置</div>
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

    host.querySelector('#plot-script-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'scripts');
      const script = { id, chapter_id: '', dialogs: [] };
      const cur = App.data.scripts.findIndex((x) => x.id === App.cur.scriptId);
      if (cur >= 0) App.data.scripts.splice(cur + 1, 0, script);
      else App.data.scripts.push(script);
      App.cur.scriptId = id;
      App.cur.dialogId = '';
      commit();
      this.updateScripts();
      this.updateDialogs();
      this.renderTabs();
    });
    host.querySelector('#plot-script-del').addEventListener('click', () => {
      const idx = App.data.scripts.findIndex((x) => x.id === App.cur.scriptId);
      const s = App.data.scripts[idx];
      if (!s) return;
      if (!confirm(`确定删除剧情 ${s.id}？`)) return;
      App.data.scripts.splice(idx, 1);
      App.cur.scriptId = App.data.scripts.length ? App.data.scripts[Math.min(idx, App.data.scripts.length - 1)].id : '';
      App.cur.dialogId = '';
      commit();
      this.updateScripts();
      this.updateDialogs();
      this.renderTabs();
    });
    host.querySelector('#plot-export').addEventListener('click', async () => {
      await flushCommit();
      const s = this.script();
      if (!s) { alert('请先选择要导出的剧情。'); return; }
      const ok = await call('export_script', s.id);
      if (ok) toast('已导出');
    });

    host.querySelector('#dlg-add-text').addEventListener('click', () => this.addDialog('text'));
    host.querySelector('#dlg-add-choice').addEventListener('click', () => this.addDialog('choice'));
    host.querySelector('#dlg-copy').addEventListener('click', () => this.copyDialog());
    host.querySelector('#dlg-up').addEventListener('click', () => this.moveDialog(-1));
    host.querySelector('#dlg-down').addEventListener('click', () => this.moveDialog(1));
    host.querySelector('#dlg-del').addEventListener('click', () => this.deleteSelectedDialogs());

    this.updateScripts();
    this.updateDialogs();
    this.renderTabs();
  },

  /* ---------- 状态 ---------- */

  script() { return App.data.scripts.find((s) => s.id === App.cur.scriptId) || null; },

  dialog() {
    const s = this.script();
    return s ? s.dialogs.find((d) => d.id === App.cur.dialogId) || null : null;
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

  updateScripts() {
    const el = document.getElementById('plots-scripts');
    if (!el) return;
    el.innerHTML = (App.data.scripts || []).map((s) => `
      <div class="list-item${s.id === App.cur.scriptId ? ' active' : ''}" data-id="${esc(s.id)}">
        ${esc(s.id)}<span class="sub">${(s.dialogs || []).length} 条对话</span>
      </div>`).join('') || '<div class="empty">暂无剧情</div>';
    el.querySelectorAll('.list-item').forEach((it) => {
      it.addEventListener('click', () => {
        App.cur.scriptId = it.dataset.id;
        App.cur.dialogId = '';
        App.cur.dlgSel = new Set();
        this.updateScripts();
        this.updateDialogs();
        this.renderTabs();
      });
    });
  },

  updateDialogs() {
    const el = document.getElementById('plots-dialogs');
    if (!el) return;
    const s = this.script();
    if (!s) { el.innerHTML = '<div class="empty">选择或新建剧情</div>'; return; }
    const selSet = App.cur.dlgSel || new Set();
    el.innerHTML = s.dialogs.map((d) => `
      <div class="list-item${d.id === App.cur.dialogId ? ' active' : ''}${selSet.has(d.id) ? ' multi-selected' : ''}" data-id="${esc(d.id)}">
        <input type="checkbox" class="multi-check" data-id="${esc(d.id)}"${selSet.has(d.id) ? ' checked' : ''} title="多选">
        <span class="drag-handle" title="拖动排序">⠿</span>
        ${d.type === 'choice' ? '【选项】' : '【文本】'} ${esc(d.id)}<span class="sub">${d.speaker_label ? esc(d.speaker_label) + '：' : ''}${esc((d.content || '').slice(0, 18))}</span>
      </div>`).join('') || '<div class="empty">暂无对话</div>';
    el.querySelectorAll('.list-item').forEach((it) => {
      it.addEventListener('click', (e) => {
        if (e.target.closest('.multi-check')) return;
        if (e.ctrlKey || e.metaKey) {
          const cb = it.querySelector('.multi-check');
          cb.checked = !cb.checked;
          if (cb.checked) selSet.add(it.dataset.id); else selSet.delete(it.dataset.id);
          this.updateDialogs();
          return;
        }
        App.cur.dialogId = it.dataset.id;
        this.updateDialogs();
        this.renderTabs();
      });
    });
    el.querySelectorAll('.multi-check').forEach((cb) => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cb.checked) selSet.add(cb.dataset.id); else selSet.delete(cb.dataset.id);
        this.updateDialogs();
      });
    });
    this.bindDialogSort();
  },

  deleteSelectedDialogs() {
    const s = this.script();
    if (!s) return;
    const selSet = App.cur.dlgSel || new Set();
    if (!selSet.size && App.cur.dialogId) selSet.add(App.cur.dialogId);
    if (!selSet.size) { toast('请先勾选要删除的对话'); return; }
    if (!confirm(`确定删除所选 ${selSet.size} 条对话？`)) return;
    s.dialogs = s.dialogs.filter((d) => !selSet.has(d.id));
    selSet.clear();
    App.cur.dialogId = s.dialogs.length ? s.dialogs[0].id : '';
    commit();
    this.updateDialogs();
    this.renderTabs();
  },

  bindDialogSort() {
    const el = document.getElementById('plots-dialogs');
    if (!el) return;
    if (this._dlgSort) {
      if (this._dlgSort.el === el) return;
      this._dlgSort.destroy();
      this._dlgSort = null;
    }
    this._dlgSort = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const s = this.script();
        if (!s) return;
        const order = Array.from(el.querySelectorAll('.list-item')).map((it) => it.dataset.id);
        const byId = {};
        s.dialogs.forEach((d) => { byId[d.id] = d; });
        s.dialogs = order.map((id) => byId[id]).filter(Boolean);
        commit();
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
    if (!d) { content.innerHTML = '<div class="empty">选择或新建一条对话</div>'; return; }
    content.innerHTML = `
      <div x-data="galgenDialogForm()" class="field-grid">
        <label class="field"><span>类型</span>
          <select x-model="d.type" @change="onTypeChange()">
            <option value="text">文本</option>
            <option value="choice">选项</option>
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
        <label class="field"><span>背景音乐</span>
          <select x-model="d.bgm" @change="commit()" x-html="bgmOptionsHtml"></select>
        </label>
        <label class="field field-full"><span>对话内容（选项类型时此处为问题文本）</span>
          <textarea x-model="d.content" @input.debounce.500ms="commit(); updateListItem()"></textarea>
        </label>
      </div>`;
  },

  renderOptionsTab(content) {
    const d = this.dialog();
    if (!d) { content.innerHTML = '<div class="empty">选择一条对话</div>'; return; }
    if (d.type !== 'choice') { content.innerHTML = '<div class="empty">该对话为文本类型，无选项。</div>'; return; }
    const options = d.options || [];
    content.innerHTML = `
      <table class="data sortable-table">
        <thead><tr><th style="width:28px"></th><th style="width:120px">ID</th><th>内容</th><th>跳转</th><th>结局</th><th>解锁</th><th></th></tr></thead>
        <tbody id="opt-tbody">
          ${options.map((o, i) => {
            const unlocks = [];
            if ((o.effects || []).length) unlocks.push(`${o.effects.length} 项效果`);
            if (o.unlock_cg) unlocks.push('CG');
            if (o.unlock_script) unlocks.push('剧情');
            return `<tr data-idx="${i}">
              <td class="drag-handle" title="拖动排序">⠿</td>
              <td><span class="table-id">${esc(o.id)}</span></td>
              <td class="opt-content">${esc(o.content) || '<span class="placeholder">（空选项）</span>'}</td>
              <td>${esc(o.jump_to || '—')}</td>
              <td>${esc(o.ending_id || '—')}</td>
              <td>${esc(unlocks.join('、') || '—')}</td>
              <td><button class="btn btn-sm opt-edit">编辑</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" class="empty">暂无选项</td></tr>'}
        </tbody>
      </table>
      <div class="toolbar">
        <button class="btn btn-primary" id="opt-add">+ 新增选项</button>
        <button class="btn btn-danger" id="opt-del">删除所选</button>
      </div>
      <div class="hint" style="margin-top:6px;">拖动 ⠿ 可调整选项顺序。</div>`;
    content.querySelectorAll('.opt-edit').forEach((btn) => {
      btn.addEventListener('click', () => this.openOptionEditor(+btn.closest('tr').dataset.idx));
    });
    content.querySelector('#opt-add').addEventListener('click', () => {
      d.options.push({ id: this.nextOptionId(d), content: '', jump_to: '', effects: [], unlock_cg: '', unlock_script: '', ending_id: '' });
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
        <div class="field-grid">
          <label class="field"><span>跳转目标（对话或剧情）</span>
            <select x-model="opt.jump_to" x-html="jumpOptionsHtml"></select>
          </label>
          <label class="field"><span>指向结局</span>
            <select x-model="opt.ending_id" x-html="endingOptionsHtml"></select>
          </label>
          <label class="field"><span>解锁 CG</span>
            <select x-model="opt.unlock_cg" x-html="cgOptionsHtml"></select>
          </label>
          <label class="field"><span>解锁隐藏剧情</span>
            <select x-model="opt.unlock_script" x-html="scriptOptionsHtml"></select>
          </label>
        </div>
        <label class="field"><span>变量修改效果</span>
          <div>
            <template x-for="(e, i) in opt.effects" :key="i">
              <div class="kv-row effect-row">
                <select class="ef-target" x-model="e.target" x-html="targetOptionsHtml(e)" style="flex:1;"></select>
                <input class="ef-var" x-model="e.variable" placeholder="变量名" style="flex:1;">
                <select class="ef-op" x-model="e.operation" x-html="opOptionsHtml(e)" style="flex:1;"></select>
                <input type="number" class="ef-val" x-model.number="e.value" style="flex:1;">
                <button class="btn btn-sm btn-danger ef-del" @click="removeEffect(i)">×</button>
              </div>
            </template>
            <div x-show="!opt.effects.length" class="empty" style="padding:8px;">暂无效果</div>
          </div>
        </label>
        <div class="toolbar">
          <button class="btn btn-sm" @click="addEffect()">+ 新增效果</button>
        </div>
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
        // 点击节点 → 定位到对话列表并切到表单
        App.cur.dialogId = dialogId;
        App.cur.plotTab = 'form';
        this.updateDialogs();
        this.renderTabs();
      });
    });
  },

  /* ---------- 对话操作 ---------- */

  addDialog(type) {
    const s = this.script();
    if (!s) { alert('请先新建或选择一个剧情。'); return; }
    const d = { id: this.nextDialogId(), type, character_id: '', speaker_label: '', standee: '', expression: '', voice: '', scene_id: '', bgm: '', content: '', options: type === 'choice' ? [] : undefined };
    if (type !== 'choice') delete d.options;
    const cur = s.dialogs.findIndex((x) => x.id === App.cur.dialogId);
    if (cur >= 0) s.dialogs.splice(cur + 1, 0, d);
    else s.dialogs.push(d);
    App.cur.dialogId = d.id;
    commit();
    this.updateDialogs();
    this.renderTabs();
  },

  copyDialog() {
    const d = this.dialog();
    const s = this.script();
    if (!d || !s) return;
    const copy = JSON.parse(JSON.stringify(d));
    copy.id = this.nextDialogId();
    if (copy.type === 'choice') {
      (copy.options || []).forEach((o, i) => { o.id = `${copy.id}_opt_${String(i + 1).padStart(4, '0')}`; });
    }
    s.dialogs.splice(s.dialogs.indexOf(d) + 1, 0, copy);
    App.cur.dialogId = copy.id;
    commit();
    this.updateDialogs();
    this.renderTabs();
  },

  moveDialog(delta) {
    const d = this.dialog();
    const s = this.script();
    if (!d || !s) return;
    const i = s.dialogs.indexOf(d);
    const j = i + delta;
    if (j < 0 || j >= s.dialogs.length) return;
    [s.dialogs[i], s.dialogs[j]] = [s.dialogs[j], s.dialogs[i]];
    commit();
    this.updateDialogs();
  },

  deleteDialog() {
    const s = this.script();
    if (!s) return;
    const idx = s.dialogs.findIndex((x) => x.id === App.cur.dialogId);
    const d = s.dialogs[idx];
    if (!d) return;
    if (!confirm(`确定删除对话 ${d.id}？`)) return;
    s.dialogs.splice(idx, 1);
    App.cur.dialogId = s.dialogs.length ? s.dialogs[Math.min(idx, s.dialogs.length - 1)].id : '';
    commit();
    this.updateDialogs();
    this.renderTabs();
  },

  updateDialogListItem() {
    const d = this.dialog();
    const el = document.getElementById('plots-dialogs');
    if (!d || !el) return;
    const it = el.querySelector(`.list-item[data-id="${CSS.escape(d.id)}"]`);
    if (it) {
      const sub = it.querySelector('.sub');
      it.childNodes[0].nodeValue = `${d.type === 'choice' ? '【选项】' : '【文本】'} ${d.id} `;
      if (sub) sub.textContent = (d.speaker_label ? `${d.speaker_label}：` : '') + (d.content || '').slice(0, 18);
    }
  },
};
