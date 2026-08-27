/* 剧情编辑器页面（对话/选项/分支树）。 */

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
      const id = await call('next_id', 'scripts');
      App.data.scripts.push({ id, chapter_id: '', dialogs: [] });
      App.cur.scriptId = id;
      App.cur.dialogId = '';
      commit();
      this.updateScripts();
      this.updateDialogs();
      this.renderTabs();
    });
    host.querySelector('#plot-script-del').addEventListener('click', () => {
      const s = this.script();
      if (!s) return;
      if (!confirm(`确定删除剧情 ${s.id}？`)) return;
      App.data.scripts = App.data.scripts.filter((x) => x.id !== s.id);
      App.cur.scriptId = '';
      App.cur.dialogId = '';
      commit();
      this.updateScripts();
      this.updateDialogs();
      this.renderTabs();
    });
    host.querySelector('#plot-export').addEventListener('click', async () => {
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
    host.querySelector('#dlg-del').addEventListener('click', () => this.deleteDialog());

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
    el.innerHTML = s.dialogs.map((d) => `
      <div class="list-item${d.id === App.cur.dialogId ? ' active' : ''}" data-id="${esc(d.id)}">
        ${d.type === 'choice' ? '【选项】' : '【文本】'} ${esc(d.id)}<span class="sub">${esc((d.content || '').slice(0, 18))}</span>
      </div>`).join('') || '<div class="empty">暂无对话</div>';
    el.querySelectorAll('.list-item').forEach((it) => {
      it.addEventListener('click', () => {
        App.cur.dialogId = it.dataset.id;
        this.updateDialogs();
        this.renderTabs();
      });
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
    const chars = App.data.characters || [];
    const scenes = App.data.scenes || [];
    const standees = filterByCategory(App.data.assets, 'standee');
    const voices = filterByCategory(App.data.assets, 'voice');
    const bgms = filterByCategory(App.data.assets, 'bgm');
    const char = chars.find((c) => c.id === d.character_id);
    const exprKeys = char ? Object.keys(char.expressions || {}) : [];

    content.innerHTML = `
      <div class="field-grid">
        <label class="field"><span>类型</span><select id="pf-type">${optionsHtml([{ v: 'text', t: '文本' }, { v: 'choice', t: '选项' }], 'v', (x) => x.t, d.type)}</select></label>
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(d.id)}"></label>
        <label class="field"><span>角色</span><select id="pf-char">${optionsHtml(chars, 'id', (c) => c.name, d.character_id, '(旁白)')}</select></label>
        <label class="field"><span>表情</span><select id="pf-expr">${optionsHtml(exprKeys, '', (k) => k, d.expression, '(无)')}</select></label>
        <label class="field"><span>立绘</span><select id="pf-standee">${optionsHtml(standees, 'id', (a) => `${a.file_name} (${a.id})`, d.standee, '(无)')}</select></label>
        <label class="field"><span>语音</span><select id="pf-voice">${optionsHtml(voices, 'id', (a) => `${a.file_name} (${a.id})`, d.voice, '(无)')}</select></label>
        <label class="field"><span>场景</span><select id="pf-scene">${optionsHtml(scenes, 'id', (s) => s.name, d.scene_id, '(无)')}</select></label>
        <label class="field"><span>背景音乐</span><select id="pf-bgm">${optionsHtml(bgms, 'id', (a) => `${a.file_name} (${a.id})`, d.bgm, '(无)')}</select></label>
        <label class="field field-full"><span>对话内容（选项类型时此处为问题文本）</span><textarea id="pf-content">${esc(d.content)}</textarea></label>
      </div>`;

    const bind = (id, evt, fn) => content.querySelector(id).addEventListener(evt, fn);
    bind('#pf-type', 'change', (e) => {
      d.type = e.target.value;
      if (d.type === 'choice' && !d.options) d.options = [];
      commit();
      this.updateDialogs();
      this.renderTabs();
    });
    bind('#pf-char', 'change', (e) => { d.character_id = e.target.value; commit(); this.renderFormTab(content); });
    bind('#pf-expr', 'change', (e) => { d.expression = e.target.value; commit(); });
    bind('#pf-standee', 'change', (e) => { d.standee = e.target.value; commit(); });
    bind('#pf-voice', 'change', (e) => { d.voice = e.target.value; commit(); });
    bind('#pf-scene', 'change', (e) => { d.scene_id = e.target.value; commit(); });
    bind('#pf-bgm', 'change', (e) => { d.bgm = e.target.value; commit(); });
    bind('#pf-content', 'input', (e) => { d.content = e.target.value; commit(); this.updateDialogListItem(); });
  },

  renderOptionsTab(content) {
    const d = this.dialog();
    if (!d) { content.innerHTML = '<div class="empty">选择一条对话</div>'; return; }
    if (d.type !== 'choice') { content.innerHTML = '<div class="empty">该对话为文本类型，无选项。</div>'; return; }
    const options = d.options || [];
    content.innerHTML = `
      <table class="data">
        <thead><tr><th style="width:120px">ID</th><th>内容</th><th>跳转</th><th>结局</th><th>解锁</th><th></th></tr></thead>
        <tbody>
          ${options.map((o, i) => {
            const unlocks = [];
            if ((o.effects || []).length) unlocks.push(`${o.effects.length} 项效果`);
            if (o.unlock_cg) unlocks.push('CG');
            if (o.unlock_script) unlocks.push('剧情');
            return `<tr data-idx="${i}">
              <td><span class="table-id">${esc(o.id)}</span></td>
              <td class="opt-content">${esc(o.content) || '<span class="placeholder">（空选项）</span>'}</td>
              <td>${esc(o.jump_to || '—')}</td>
              <td>${esc(o.ending_id || '—')}</td>
              <td>${esc(unlocks.join('、') || '—')}</td>
              <td><button class="btn btn-sm opt-edit">编辑</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="6" class="empty">暂无选项</td></tr>'}
        </tbody>
      </table>
      <div class="toolbar">
        <button class="btn btn-primary" id="opt-add">+ 新增选项</button>
        <button class="btn btn-danger" id="opt-del">删除所选</button>
      </div>`;
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
  },

  /* ---------- 选项编辑器（模态框） ---------- */

  openOptionEditor(idx) {
    const d = this.dialog();
    const opt = d.options[idx];
    const s = this.script();
    const chars = App.data.characters || [];
    const endings = App.data.endings || [];
    const cgs = filterByCategory(App.data.assets, 'cg');

    // 跳转目标：当前剧情对话 + 其他剧情（跨脚本跳转）
    const jumpOptions = [];
    (s.dialogs || []).forEach((x) => {
      jumpOptions.push({ v: x.id, label: `${x.id} · ${(x.content || '').slice(0, 14)}` });
    });
    (App.data.scripts || []).forEach((x) => {
      if (x.id !== s.id) jumpOptions.push({ v: x.id, label: `【剧情】${x.id}（${(x.dialogs || []).length} 条对话）` });
    });

    const effectsHtml = (opt.effects || []).map((e, i) => `
      <div class="kv-row effect-row" data-idx="${i}">
        <select class="ef-target" style="flex:1;">${optionsHtml(chars, 'id', (c) => c.name, e.target, 'global（全局）')}</select>
        <input class="ef-var" value="${esc(e.variable)}" placeholder="变量名" style="flex:1;">
        <select class="ef-op" style="flex:1;">${optionsHtml([{ v: 'add', t: '＋ 增加' }, { v: 'sub', t: '－ 减少' }, { v: 'set', t: '＝ 设为' }], 'v', (x) => x.t, e.operation)}</select>
        <input type="number" class="ef-val" value="${e.value ?? 0}" style="flex:1;">
        <button class="btn btn-sm btn-danger ef-del">×</button>
      </div>`).join('');

    const modal = openModal(`
      <h3>编辑选项</h3>
      <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(opt.id)}"></label>
      <label class="field"><span>选项内容</span><input id="oe-content" value="${esc(opt.content)}"></label>
      <div class="field-grid">
        <label class="field"><span>跳转目标（对话或剧情）</span><select id="oe-jump">${optionsHtml(jumpOptions, 'v', (x) => x.label, opt.jump_to, '(剧情结束)')}</select></label>
        <label class="field"><span>指向结局</span><select id="oe-ending">${optionsHtml(endings, 'id', (e) => `${e.name} (${e.id})`, opt.ending_id, '(无)')}</select></label>
        <label class="field"><span>解锁 CG</span><select id="oe-cg">${optionsHtml(cgs, 'id', (a) => `${a.file_name} (${a.id})`, opt.unlock_cg, '(无)')}</select></label>
        <label class="field"><span>解锁隐藏剧情</span><select id="oe-script">${optionsHtml(App.data.scripts, 'id', (x) => x.id, opt.unlock_script, '(无)')}</select></label>
      </div>
      <label class="field"><span>变量修改效果</span><div id="oe-effects">${effectsHtml || '<div class="empty" style="padding:8px;">暂无效果</div>'}</div></label>
      <div class="toolbar">
        <button class="btn btn-sm" id="oe-add-effect">+ 新增效果</button>
      </div>
      <div class="divider"></div>
      <div class="toolbar" style="justify-content:flex-end;">
        <button class="btn" id="oe-cancel">取消</button>
        <button class="btn btn-primary" id="oe-ok">确定</button>
      </div>
    `);

    modal.querySelector('#oe-cancel').addEventListener('click', closeModal);
    modal.querySelector('#oe-add-effect').addEventListener('click', () => {
      const box = modal.querySelector('#oe-effects');
      const empty = box.querySelector('.empty');
      if (empty) empty.remove();
      const row = document.createElement('div');
      row.className = 'kv-row effect-row';
      row.innerHTML = `
        <select class="ef-target" style="flex:1;">${optionsHtml(chars, 'id', (c) => c.name, '', 'global（全局）')}</select>
        <input class="ef-var" placeholder="变量名" style="flex:1;">
        <select class="ef-op" style="flex:1;">${optionsHtml([{ v: 'add', t: '＋ 增加' }, { v: 'sub', t: '－ 减少' }, { v: 'set', t: '＝ 设为' }], 'v', (x) => x.t, 'add')}</select>
        <input type="number" class="ef-val" value="0" style="flex:1;">
        <button class="btn btn-sm btn-danger ef-del">×</button>`;
      row.querySelector('.ef-del').addEventListener('click', () => row.remove());
      box.appendChild(row);
    });
    modal.querySelectorAll('.ef-del').forEach((btn) => btn.addEventListener('click', () => btn.closest('.effect-row').remove()));

    modal.querySelector('#oe-ok').addEventListener('click', () => {
      opt.content = modal.querySelector('#oe-content').value;
      opt.jump_to = modal.querySelector('#oe-jump').value;
      opt.ending_id = modal.querySelector('#oe-ending').value;
      opt.unlock_cg = modal.querySelector('#oe-cg').value;
      opt.unlock_script = modal.querySelector('#oe-script').value;
      opt.effects = Array.from(modal.querySelectorAll('.effect-row')).map((row) => ({
        target: row.querySelector('.ef-target').value,
        variable: row.querySelector('.ef-var').value.trim(),
        operation: row.querySelector('.ef-op').value,
        value: parseInt(row.querySelector('.ef-val').value, 10) || 0,
      })).filter((e) => e.variable);
      commit();
      closeModal();
      this.renderTabs();
    });
  },

  /* ---------- 分支树 ---------- */

  renderTreeTab(content) {
    const s = this.script();
    if (!s) { content.innerHTML = '<div class="empty">选择或新建剧情</div>'; return; }
    content.innerHTML = `<div class="hint" style="margin-bottom:10px;">展开选项节点可查看跳转条件与绑定结果。</div>
      <ul class="tree">${s.dialogs.map((d) => {
        const node = `<span class="node${d.type === 'choice' ? ' choice' : ''}"><span class="tag">${d.type === 'choice' ? '选项' : '文本'}</span>${esc(d.id)}</span> <span class="branch-desc">${esc((d.content || '').slice(0, 30))}</span>`;
        if (d.type !== 'choice') return `<li>${node}</li>`;
        const kids = (d.options || []).map((o) => {
          const desc = [];
          if (o.jump_to) desc.push(`跳转 ${o.jump_to}`);
          if (o.ending_id) desc.push(`结局 ${o.ending_id}`);
          (o.effects || []).forEach((e) => desc.push(`${e.target}.${e.variable}${e.operation}${e.value}`));
          if (o.unlock_cg) desc.push('解锁CG');
          if (o.unlock_script) desc.push('解锁剧情');
          return `<li><span class="node choice"><span class="tag">→</span>${esc(o.content || '(空)')}</span> <span class="branch-desc">${desc.length ? esc(desc.join('；')) : '对话结束'}</span></li>`;
        }).join('');
        return `<li>${node}<ul>${kids}</ul></li>`;
      }).join('') || '<li class="empty">暂无对话</li>'}</ul>`;
  },

  /* ---------- 对话操作 ---------- */

  addDialog(type) {
    const s = this.script();
    if (!s) { alert('请先新建或选择一个剧情。'); return; }
    const d = { id: this.nextDialogId(), type, character_id: '', standee: '', expression: '', voice: '', scene_id: '', bgm: '', content: '', options: type === 'choice' ? [] : undefined };
    if (type !== 'choice') delete d.options;
    s.dialogs.push(d);
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
    const d = this.dialog();
    const s = this.script();
    if (!d || !s) return;
    if (!confirm(`确定删除对话 ${d.id}？`)) return;
    s.dialogs.splice(s.dialogs.indexOf(d), 1);
    App.cur.dialogId = '';
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
      if (sub) sub.textContent = (d.content || '').slice(0, 18);
    }
  },
};
