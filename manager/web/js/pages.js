/* GalGen 管理器前端页面。 */

/* ==================== 通用 KV 编辑器 ==================== */

/* 字符串列表编辑器（如角色显示名列表）。 */
function kvListEditor(container, list, label) {
  container.innerHTML = '';
  const rows = document.createElement('div');
  rows.className = 'kv-editor';

  function kvRow(i, v) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const input = document.createElement('input');
    input.className = 'kv-val';
    input.value = v;
    input.placeholder = label;
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger kv-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      list.splice(i, 1);
      kvListEditor(container, list, label);
      commit();
    });
    input.addEventListener('input', () => {
      list[i] = input.value;
      commit();
    });
    row.appendChild(input);
    row.appendChild(del);
    return row;
  }

  list.forEach((v, i) => rows.appendChild(kvRow(i, v)));
  const add = document.createElement('button');
  add.className = 'btn kv-add';
  add.textContent = `+ 添加${label}`;
  add.addEventListener('click', () => {
    list.push(`新${label}`);
    kvListEditor(container, list, label);
    commit();
  });
  container.appendChild(rows);
  container.appendChild(add);
}

function kvEditor(container, obj, label) {
  container.innerHTML = '';
  const rows = document.createElement('div');
  rows.className = 'kv-editor';

  function kvRow(k, v) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const kInput = document.createElement('input');
    kInput.className = 'kv-key';
    kInput.value = k;
    kInput.placeholder = '键';
    const vInput = document.createElement('input');
    vInput.className = 'kv-val';
    vInput.value = v ?? '';
    vInput.placeholder = '值';
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger kv-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      delete obj[k];
      kvEditor(container, obj, label);
      commit();
    });
    kInput.addEventListener('input', () => {
      const old = k;
      const nk = kInput.value.trim();
      if (!nk) return;
      if (nk !== old) {
        delete obj[old];
        obj[nk] = vInput.value;
      }
      commit();
    });
    vInput.addEventListener('input', () => { obj[k] = vInput.value; commit(); });
    row.appendChild(kInput);
    row.appendChild(vInput);
    row.appendChild(del);
    return row;
  }

  Object.keys(obj || {}).forEach((k) => rows.appendChild(kvRow(k, obj[k])));
  const add = document.createElement('button');
  add.className = 'btn kv-add';
  add.textContent = `+ 添加${label}`;
  add.addEventListener('click', () => {
    obj[`新键_${Object.keys(obj).length + 1}`] = '';
    kvEditor(container, obj, label);
    commit();
  });
  container.appendChild(rows);
  container.appendChild(add);
}

/* ==================== 角色页 ==================== */

App.Pages.characters = {
  render(host) {
    const chars = App.data.characters;
    host.innerHTML = `
    <div class="hsplit" id="chars-hsplit">
      <div class="side" id="chars-side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">角色</div>
          <div class="list" id="char-list">
            ${chars.map((c) => `
              <div class="list-item${c.id === App.cur.characterId ? ' active' : ''}" data-id="${esc(c.id)}">
                ${esc(c.name)}<span class="sub">${esc(c.id)}</span>
              </div>`).join('') || '<div class="empty">暂无角色</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="char-add">新建角色</button>
            <button class="btn btn-danger" id="char-del">删除角色</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle" data-group="chars-hsplit"></div>
      <div class="main panel" style="overflow:auto;" id="char-form">${this.formHtml()}</div>
    </div>`;

    const list = host.querySelector('#char-list');
    list.addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.characterId = it.dataset.id; renderPage(); }
    });
    host.querySelector('#char-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'characters');
      App.data.characters.push({ id, name: '新角色', description: '', personality: '', variables: {}, constants: {}, default_standee: '', standees: [], voice: '', labels: [] });
      App.cur.characterId = id;
      commit();
      renderPage();
    });
    host.querySelector('#char-del').addEventListener('click', () => {
      const c = App.data.characters.find((x) => x.id === App.cur.characterId);
      if (!c) return;
      if (!confirm(`确定删除角色「${c.name}」？`)) return;
      App.data.characters = App.data.characters.filter((x) => x.id !== c.id);
      App.cur.characterId = App.data.characters.length ? App.data.characters[0].id : '';
      commit();
      renderPage();
    });
    this.bindForm(host);
    bindSplitters(host);
  },

  formHtml() {
    const c = App.data.characters.find((x) => x.id === App.cur.characterId);
    if (!c) return '<div class="empty">选择或新建一个角色</div>';
    const voices = filterByCategory(App.data.assets, 'voice');
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(c.id)}"></label>
        <label class="field"><span>名称</span><input class="input-lg" id="c-name" value="${esc(c.name)}"></label>
        <label class="field"><span>默认语音</span><select id="c-voice">${optionsHtml(voices, 'id', (a) => `${a.file_name} (${a.id})`, c.voice, '(无)')}</select></label>
        <label class="field field-full"><span>简介</span><textarea id="c-desc">${esc(c.description)}</textarea></label>
        <label class="field field-full"><span>性格说明</span><textarea id="c-personality">${esc(c.personality)}</textarea></label>
        <div class="field field-full"><span>显示名（剧情中作为说话者显示名下拉选项，如「孩子」「康斯坦丁」）</span><div id="c-labels"></div></div>
        <div class="field field-full"><span>立绘（列表式管理；剧情中立绘仅能选择当前角色的立绘）</span><div id="c-standees"></div></div>
        <div class="field field-full"><span>变量（如好感度）</span><div id="c-variables"></div></div>
        <div class="field field-full"><span>常量（年龄、生日等）</span><div id="c-constants"></div></div>
      </div>`;
  },

  bindForm(host) {
    const c = App.data.characters.find((x) => x.id === App.cur.characterId);
    if (!c) return;
    if (!Array.isArray(c.labels)) c.labels = [];
    if (!Array.isArray(c.standees)) c.standees = [];
    const f = host.querySelector('#char-form');
    f.querySelector('#c-name').addEventListener('input', (e) => { c.name = e.target.value; commit(); });
    f.querySelector('#c-desc').addEventListener('input', (e) => { c.description = e.target.value; commit(); });
    f.querySelector('#c-personality').addEventListener('input', (e) => { c.personality = e.target.value; commit(); });
    f.querySelector('#c-voice').addEventListener('change', (e) => { c.voice = e.target.value; commit(); });
    kvListEditor(f.querySelector('#c-labels'), c.labels, '显示名');
    standeeListEditor(f.querySelector('#c-standees'), c, commit);
    kvEditor(f.querySelector('#c-variables'), c.variables, '变量');
    kvEditor(f.querySelector('#c-constants'), c.constants, '常量');
  },
};

/* 角色立绘列表编辑器：添加（从资产选择/上传）、删除、重命名、设为默认。 */
function standeeListEditor(container, char, commit) {
  container.innerHTML = '';
  const standeeAssets = filterByCategory(App.data.assets, 'standee');
  const rows = document.createElement('div');
  rows.className = 'kv-editor';

  const renderRow = (st, i) => {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const nameInput = document.createElement('input');
    nameInput.className = 'kv-key';
    nameInput.value = st.name;
    nameInput.placeholder = '立绘名（如 normal）';
    const sel = document.createElement('select');
    sel.className = 'kv-val';
    sel.innerHTML = optionsHtml(standeeAssets, 'id', (a) => `${a.file_name} (${a.id})`, st.asset_id, '（选择资产）');
    const defBtn = document.createElement('button');
    defBtn.className = 'btn btn-sm';
    defBtn.textContent = char.default_standee === st.asset_id ? '★默认' : '默认';
    defBtn.title = '设为默认立绘';
    defBtn.addEventListener('click', () => {
      char.default_standee = st.asset_id;
      commit();
      standeeListEditor(container, char, commit);
    });
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger kv-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      char.standees.splice(i, 1);
      if (char.default_standee === st.asset_id) char.default_standee = '';
      commit();
      standeeListEditor(container, char, commit);
    });
    nameInput.addEventListener('input', () => { st.name = nameInput.value; commit(); });
    sel.addEventListener('change', () => { st.asset_id = sel.value; commit(); });
    row.appendChild(nameInput);
    row.appendChild(sel);
    row.appendChild(defBtn);
    row.appendChild(del);
    return row;
  };

  char.standees.forEach((st, i) => rows.appendChild(renderRow(st, i)));

  const addBar = document.createElement('div');
  addBar.className = 'toolbar';
  const btnPick = document.createElement('button');
  btnPick.className = 'btn btn-sm';
  btnPick.textContent = '+ 从资产选择立绘';
  btnPick.addEventListener('click', () => {
    if (!standeeAssets.length) { toast('暂无立绘资产，请先上传'); return; }
    char.standees.push({ name: `立绘${char.standees.length + 1}`, asset_id: standeeAssets[0].id });
    commit();
    standeeListEditor(container, char, commit);
  });
  const btnUpload = document.createElement('button');
  btnUpload.className = 'btn btn-sm';
  btnUpload.textContent = '+ 上传新立绘';
  btnUpload.addEventListener('click', async () => {
    await flushCommit();
    const asset = await call('upload_asset', 'standee');
    if (!asset) return;
    if (asset.error) { toast(asset.error); return; }
    App.data.assets.push(asset);
    char.standees.push({ name: `立绘${char.standees.length + 1}`, asset_id: asset.id });
    commit();
    const payload = await call('get_data');
    if (payload) { App.filePath = payload.file_path || App.filePath; }
    standeeListEditor(container, char, commit);
  });
  addBar.appendChild(btnPick);
  addBar.appendChild(btnUpload);
  container.appendChild(rows);
  container.appendChild(addBar);
}

/* ==================== 场景页 ==================== */

App.Pages.scenes = {
  render(host) {
    const scenes = App.data.scenes;
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">场景</div>
          <div class="list" id="scene-list">
            ${scenes.map((s) => `
              <div class="list-item${s.id === App.cur.sceneId ? ' active' : ''}" data-id="${esc(s.id)}">
                ${esc(s.name)}<span class="sub">${esc(s.id)}</span>
              </div>`).join('') || '<div class="empty">暂无场景</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="scene-add">新建场景</button>
            <button class="btn btn-danger" id="scene-del">删除场景</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    listSelect(host.querySelector('#scene-list'), 'sceneId', () => renderPage());
    host.querySelector('#scene-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'scenes');
      App.data.scenes.push({ id, name: '新场景', background: '', description: '' });
      App.cur.sceneId = id;
      commit();
      renderPage();
    });
    host.querySelector('#scene-del').addEventListener('click', () => {
      const idx = App.data.scenes.findIndex((x) => x.id === App.cur.sceneId);
      const s = App.data.scenes[idx];
      if (!s) return;
      if (!confirm(`确定删除场景「${s.name}」？`)) return;
      App.data.scenes.splice(idx, 1);
      App.cur.sceneId = App.data.scenes.length ? App.data.scenes[Math.min(idx, App.data.scenes.length - 1)].id : '';
      commit();
      renderPage();
    });

    const s = App.data.scenes.find((x) => x.id === App.cur.sceneId);
    if (s) {
      const f = host.querySelector('.main');
      f.querySelector('#s-name').addEventListener('input', (e) => { s.name = e.target.value; commit(); });
      f.querySelector('#s-bg').addEventListener('change', (e) => { s.background = e.target.value; commit(); });
      f.querySelector('#s-desc').addEventListener('input', (e) => { s.description = e.target.value; commit(); });
    }
    bindSplitters(host);
  },

  formHtml() {
    const s = App.data.scenes.find((x) => x.id === App.cur.sceneId);
    if (!s) return '<div class="empty">选择或新建一个场景</div>';
    const bgs = filterByCategory(App.data.assets, 'bg');
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(s.id)}"></label>
        <label class="field"><span>名称</span><input class="input-lg" id="s-name" value="${esc(s.name)}"></label>
        <label class="field field-full"><span>背景图</span><select id="s-bg">${optionsHtml(bgs, 'id', (a) => `${a.file_name} (${a.id})`, s.background, '(无)')}</select></label>
        <label class="field field-full"><span>描述</span><textarea id="s-desc">${esc(s.description)}</textarea></label>
      </div>`;
  },
};

/* ==================== 章节页 ==================== */

App.Pages.chapters = {
  render(host) {
    const chapters = [...App.data.chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">章节</div>
          <div class="hint" style="margin-bottom:8px;">拖动 ⠿ 可调整章节顺序</div>
          <div class="list" id="chapter-list" data-multiselect="1">
            ${chapters.map((c) => `
              <div class="list-item${c.id === App.cur.chapterId ? ' active' : ''}${(host.dataset.chsel || '').split(',').includes(c.id) ? ' multi-selected' : ''}" data-id="${esc(c.id)}">
                <input type="checkbox" class="multi-check" data-id="${esc(c.id)}"${(host.dataset.chsel || '').split(',').includes(c.id) ? ' checked' : ''} title="多选">
                <span class="drag-handle" title="拖动排序">⠿</span>
                ${esc(c.name)}<span class="sub">${esc(c.id)}</span>
              </div>`).join('') || '<div class="empty">暂无章节</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="chapter-add">新建章节</button>
            <button class="btn btn-danger" id="chapter-del">删除所选</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    const getChSel = () => (host.dataset.chsel || '').split(',').filter(Boolean);
    const setChSel = (ids) => { host.dataset.chsel = [...new Set(ids)].join(','); };
    host.querySelector('#chapter-list').addEventListener('click', (e) => {
      const cb = e.target.closest('.multi-check');
      if (cb) {
        const sel = getChSel();
        if (cb.checked) sel.push(cb.dataset.id); else setChSel(sel.filter((x) => x !== cb.dataset.id));
        setChSel(sel);
        renderPage();
        return;
      }
      const it = e.target.closest('.list-item');
      if (!it) return;
      if (e.ctrlKey || e.metaKey) {
        const sel = getChSel();
        if (sel.includes(it.dataset.id)) setChSel(sel.filter((x) => x !== it.dataset.id));
        else { sel.push(it.dataset.id); setChSel(sel); }
        renderPage();
        return;
      }
      App.cur.chapterId = it.dataset.id;
      renderPage();
    });
    this.bindDragReorder(host);
    host.querySelector('#chapter-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'chapters');
      const chapter = { id, name: '新章节', order: App.data.chapters.length + 1, start_script: '', branches: [] };
      const cur = App.data.chapters.findIndex((x) => x.id === App.cur.chapterId);
      if (cur >= 0) {
        App.data.chapters.splice(cur + 1, 0, chapter);
        App.data.chapters.forEach((c, i) => { c.order = i + 1; });
      } else {
        App.data.chapters.push(chapter);
      }
      App.cur.chapterId = id;
      commit();
      renderPage();
    });
    host.querySelector('#chapter-del').addEventListener('click', () => {
      let targets = getChSel();
      if (!targets.length && App.cur.chapterId) targets = [App.cur.chapterId];
      if (!targets.length) return;
      const names = targets.map((id) => App.data.chapters.find((x) => x.id === id)?.name || id).join('、');
      if (!confirm(`确定删除所选 ${targets.length} 个章节？\n${names}`)) return;
      App.data.chapters = App.data.chapters.filter((x) => !targets.includes(x.id));
      setChSel([]);
      App.cur.chapterId = nextAfterDelete(App.data.chapters, '');
      commit();
      renderPage();
    });

    const c = App.data.chapters.find((x) => x.id === App.cur.chapterId);
    if (c) {
      const f = host.querySelector('.main');
      f.querySelector('#ch-name').addEventListener('input', (e) => { c.name = e.target.value; commit(); });
      f.querySelector('#ch-start').addEventListener('change', (e) => { c.start_script = e.target.value; commit(); });
      f.querySelector('#branch-add').addEventListener('click', () => {
        c.branches.push({ id: `${c.id}_br_${c.branches.length + 1}`, name: '新分支', condition: '', ending_id: '' });
        commit();
        renderPage();
      });
      f.querySelectorAll('.branch-row').forEach((row) => {
        const idx = +row.dataset.idx;
        const br = c.branches[idx];
        row.querySelector('.br-name').addEventListener('input', (e) => { br.name = e.target.value; commit(); });
        row.querySelector('.br-cond').addEventListener('input', (e) => { br.condition = e.target.value; commit(); });
        row.querySelector('.br-end').addEventListener('change', (e) => { br.ending_id = e.target.value; commit(); });
        row.querySelector('.br-del').addEventListener('click', () => {
          c.branches.splice(idx, 1);
          commit();
          renderPage();
        });
      });
    }
  },

  bindDragReorder(host) {
    const list = host.querySelector('#chapter-list');
    if (!list) return;
    if (this._chapterSort) {
      if (this._chapterSort.el === list) return;
      this._chapterSort.destroy();
      this._chapterSort = null;
    }
    this._chapterSort = Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      scroll: true,
      scrollSensitivity: 40,
      scrollSpeed: 20,
      bubbleScroll: true,
      onEnd: () => {
        const ids = Array.from(list.querySelectorAll('.list-item')).map((it) => it.dataset.id);
        const byId = {};
        App.data.chapters.forEach((c) => { byId[c.id] = c; });
        App.data.chapters = ids.map((id, i) => {
          const c = byId[id];
          if (c) c.order = i + 1;
          return c;
        });
        commit();
        renderPage();
      },
    });
  },

  formHtml() {
    const c = App.data.chapters.find((x) => x.id === App.cur.chapterId);
    if (!c) return '<div class="empty">选择或新建一个章节</div>';
    const endings = App.data.endings || [];
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(c.id)}"></label>
        <label class="field field-full"><span>名称</span><input class="input-lg" id="ch-name" value="${esc(c.name)}"></label>
        <label class="field field-full"><span>起始剧情</span><select id="ch-start">${optionsHtml(App.data.scripts, 'id', (s) => s.id, c.start_script, '(无)')}</select></label>
      </div>
      <div class="divider"></div>
      <div class="panel-title">章节分支（每个分支指向一个结局）</div>
      <table class="data">
        <thead><tr><th style="width:24%">名称</th><th style="width:34%">跳转条件</th><th style="width:26%">结局</th><th></th></tr></thead>
        <tbody>
          ${(c.branches || []).map((br, i) => `
            <tr class="branch-row" data-idx="${i}">
              <td><input class="br-name" value="${esc(br.name)}"></td>
              <td><input class="br-cond" value="${esc(br.condition)}" placeholder="如 affection >= 80"></td>
              <td><select class="br-end">${optionsHtml(endings, 'id', (e) => `${e.name} (${e.id})`, br.ending_id, '(无)')}</select></td>
              <td><button class="btn btn-sm btn-danger br-del">删除</button></td>
            </tr>`).join('') || '<tr><td colspan="4" class="empty">暂无分支</td></tr>'}
        </tbody>
      </table>
      <div class="toolbar">
        <button class="btn btn-sm" id="branch-add">+ 新增分支</button>
      </div>`;
  },
};

/* ==================== 结局页 ==================== */

App.Pages.endings = {
  render(host) {
    const endings = App.data.endings || [];
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">结局</div>
          <div class="list" id="ending-list" data-multiselect="1">
            ${endings.map((e) => `
              <div class="list-item${e.id === App.cur.endingId ? ' active' : ''}${(host.dataset.endsel || '').split(',').includes(e.id) ? ' multi-selected' : ''}" data-id="${esc(e.id)}">
                <input type="checkbox" class="multi-check" data-id="${esc(e.id)}"${(host.dataset.endsel || '').split(',').includes(e.id) ? ' checked' : ''} title="多选">
                ${esc(e.name)}<span class="sub">${esc(e.id)} · ${esc(e.ending_type)}${e.is_hidden ? ' · 隐藏' : ''}</span>
              </div>`).join('') || '<div class="empty">暂无结局</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="ending-add">新建结局</button>
            <button class="btn btn-danger" id="ending-del">删除所选</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    const getEndSel = () => (host.dataset.endsel || '').split(',').filter(Boolean);
    const setEndSel = (ids) => { host.dataset.endsel = [...new Set(ids)].join(','); };
    host.querySelector('#ending-list').addEventListener('click', (e) => {
      const cb = e.target.closest('.multi-check');
      if (cb) {
        const sel = getEndSel();
        if (cb.checked) sel.push(cb.dataset.id); else setEndSel(sel.filter((x) => x !== cb.dataset.id));
        setEndSel(sel);
        renderPage();
        return;
      }
      const it = e.target.closest('.list-item');
      if (!it) return;
      if (e.ctrlKey || e.metaKey) {
        const sel = getEndSel();
        if (sel.includes(it.dataset.id)) setEndSel(sel.filter((x) => x !== it.dataset.id));
        else { sel.push(it.dataset.id); setEndSel(sel); }
        renderPage();
        return;
      }
      App.cur.endingId = it.dataset.id;
      renderPage();
    });
    host.querySelector('#ending-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'endings');
      const ending = { id, name: '新结局', ending_type: 'good', description: '', cg: '', is_hidden: false };
      const cur = App.data.endings.findIndex((x) => x.id === App.cur.endingId);
      if (cur >= 0) App.data.endings.splice(cur + 1, 0, ending);
      else App.data.endings.push(ending);
      App.cur.endingId = id;
      commit();
      renderPage();
    });
    host.querySelector('#ending-del').addEventListener('click', () => {
      let targets = getEndSel();
      if (!targets.length && App.cur.endingId) targets = [App.cur.endingId];
      if (!targets.length) return;
      const names = targets.map((id) => App.data.endings.find((x) => x.id === id)?.name || id).join('、');
      if (!confirm(`确定删除所选 ${targets.length} 个结局？\n${names}`)) return;
      App.data.endings = App.data.endings.filter((x) => !targets.includes(x.id));
      setEndSel([]);
      App.cur.endingId = nextAfterDelete(App.data.endings, '');
      commit();
      renderPage();
    });

    const e = App.data.endings.find((x) => x.id === App.cur.endingId);
    if (e) {
      const f = host.querySelector('.main');
      f.querySelector('#en-name').addEventListener('input', (ev) => { e.name = ev.target.value; commit(); });
      f.querySelector('#en-type').addEventListener('change', (ev) => { e.ending_type = ev.target.value; commit(); });
      f.querySelector('#en-cg').addEventListener('change', (ev) => { e.cg = ev.target.value; commit(); });
      f.querySelector('#en-hidden').addEventListener('change', (ev) => { e.is_hidden = ev.target.checked; commit(); });
      f.querySelector('#en-desc').addEventListener('input', (ev) => { e.description = ev.target.value; commit(); });
    }
  },

  formHtml() {
    const e = App.data.endings.find((x) => x.id === App.cur.endingId);
    if (!e) return '<div class="empty">选择或新建一个结局</div>';
    const cgs = filterByCategory(App.data.assets, 'cg');
    const types = [['good', '好结局'], ['bad', '坏结局'], ['normal', '普通结局'], ['hidden', '隐藏结局']];
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(e.id)}"></label>
        <label class="field"><span>类型</span><select id="en-type">${optionsHtml(types, '0', (t) => t[1], e.ending_type)}</select></label>
        <label class="field field-full"><span>名称</span><input class="input-lg" id="en-name" value="${esc(e.name)}"></label>
        <label class="field field-full"><span>结局 CG</span><select id="en-cg">${optionsHtml(cgs, 'id', (a) => `${a.file_name} (${a.id})`, e.cg, '(无)')}</select></label>
        <label class="field field-full"><span>结局描述</span><textarea id="en-desc">${esc(e.description)}</textarea></label>
        <label class="field field-full" style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="en-hidden" ${e.is_hidden ? 'checked' : ''} style="width:auto;transform:scale(1.2);">
          <span style="margin:0;">隐藏结局（不显示在结局统计中）</span>
        </label>
      </div>`;
  },
};

/* ==================== 函数页 ==================== */

App.Pages.functions = {
  render(host) {
    const fns = App.data.functions || [];
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="panel-title">函数</div>
          <div class="list" id="fn-list">
            ${fns.map((f) => `
              <div class="list-item${f.id === App.cur.fnId ? ' active' : ''}" data-id="${esc(f.id)}">
                ${esc(f.name || f.id)}<span class="sub">${esc(f.id)}</span>
              </div>`).join('') || '<div class="empty">暂无函数</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="fn-add">新建函数</button>
            <button class="btn btn-danger" id="fn-del">删除函数</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main panel" style="overflow:auto;">${this.formHtml()}</div>
    </div>`;

    host.querySelector('#fn-list').addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.fnId = it.dataset.id; renderPage(); }
    });
    host.querySelector('#fn-add').addEventListener('click', async () => {
      await flushCommit();
      const id = await call('next_id', 'functions');
      App.data.functions.push({ id, name: '新函数', description: '', jump_to: '', unlock_cg: '', unlock_script: '', ending_id: '', effects: [] });
      App.cur.fnId = id;
      commit();
      renderPage();
    });
    host.querySelector('#fn-del').addEventListener('click', () => {
      const idx = App.data.functions.findIndex((x) => x.id === App.cur.fnId);
      const f = App.data.functions[idx];
      if (!f) return;
      if (!confirm(`确定删除函数「${f.name}」？`)) return;
      App.data.functions.splice(idx, 1);
      App.cur.fnId = App.data.functions.length ? App.data.functions[Math.min(idx, App.data.functions.length - 1)].id : '';
      commit();
      renderPage();
    });
    this.bindForm(host);
  },

  formHtml() {
    const f = App.data.functions.find((x) => x.id === App.cur.fnId);
    if (!f) return '<div class="empty">选择或新建一个函数</div>';
    const endings = App.data.endings || [];
    const scripts = App.data.scripts || [];
    const cgs = filterByCategory(App.data.assets, 'cg');
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(f.id)}"></label>
        <label class="field"><span>名称</span><input class="input-lg" id="fn-name" value="${esc(f.name)}"></label>
        <label class="field field-full"><span>描述</span><textarea id="fn-desc">${esc(f.description)}</textarea></label>
        <label class="field field-full"><span>跳转至剧情</span><select id="fn-jump">${optionsHtml(scripts, 'id', (s) => s.id, f.jump_to, '(不跳转)')}</select></label>
        <label class="field"><span>指向结局</span><select id="fn-ending">${optionsHtml(endings, 'id', (e) => `${e.name} (${e.id})`, f.ending_id, '(无)')}</select></label>
        <label class="field"><span>解锁隐藏剧情</span><select id="fn-script">${optionsHtml(scripts, 'id', (s) => s.id, f.unlock_script, '(无)')}</select></label>
        <label class="field"><span>解锁 CG</span><select id="fn-cg">${optionsHtml(cgs, 'id', (a) => `${a.file_name} (${a.id})`, f.unlock_cg, '(无)')}</select></label>
        <div class="field field-full"><span>修改变量</span><div id="fn-effects"></div></div>
      </div>`;
  },

  bindForm(host) {
    const f = App.data.functions.find((x) => x.id === App.cur.fnId);
    if (!f) return;
    const box = host.querySelector('.main');
    box.querySelector('#fn-name').addEventListener('input', (e) => { f.name = e.target.value; commit(); });
    box.querySelector('#fn-desc').addEventListener('input', (e) => { f.description = e.target.value; commit(); });
    box.querySelector('#fn-jump').addEventListener('change', (e) => { f.jump_to = e.target.value; commit(); });
    box.querySelector('#fn-ending').addEventListener('change', (e) => { f.ending_id = e.target.value; commit(); });
    box.querySelector('#fn-script').addEventListener('change', (e) => { f.unlock_script = e.target.value; commit(); });
    box.querySelector('#fn-cg').addEventListener('change', (e) => { f.unlock_cg = e.target.value; commit(); });
    // 效果编辑器
    if (!Array.isArray(f.effects)) f.effects = [];
    effectListEditor(box.querySelector('#fn-effects'), f.effects, commit);
  },
};

/* 效果列表编辑器（目标/变量/操作/值） */
function effectListEditor(container, effects, commit) {
  container.innerHTML = '';
  const rows = document.createElement('div');
  rows.className = 'kv-editor';
  const chars = App.data.characters || [];
  const ops = [['add', '＋ 增加'], ['sub', '－ 减少'], ['set', '＝ 设为']];

  const row = (e, i) => {
    const r = document.createElement('div');
    r.className = 'kv-row';
    const target = document.createElement('select');
    target.className = 'kv-val';
    target.innerHTML = optionsHtml(chars, 'id', (c) => c.name, e.target, 'global（全局）');
    const variable = document.createElement('input');
    variable.className = 'kv-key';
    variable.value = e.variable;
    variable.placeholder = '变量名';
    const op = document.createElement('select');
    op.className = 'kv-val';
    op.innerHTML = optionsHtml(ops, '0', (x) => x[1], e.operation);
    const val = document.createElement('input');
    val.type = 'number';
    val.className = 'kv-val';
    val.value = e.value ?? 0;
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger kv-del';
    del.textContent = '×';
    target.addEventListener('change', () => { e.target = target.value; commit(); });
    variable.addEventListener('input', () => { e.variable = variable.value; commit(); });
    op.addEventListener('change', () => { e.operation = op.value; commit(); });
    val.addEventListener('input', () => { e.value = parseInt(val.value, 10) || 0; commit(); });
    del.addEventListener('click', () => { effects.splice(i, 1); effectListEditor(container, effects, commit); });
    r.appendChild(target); r.appendChild(variable); r.appendChild(op); r.appendChild(val); r.appendChild(del);
    return r;
  };

  effects.forEach((e, i) => rows.appendChild(row(e, i)));
  const add = document.createElement('button');
  add.className = 'btn kv-add';
  add.textContent = '+ 添加效果';
  add.addEventListener('click', () => {
    effects.push({ target: '', variable: '', operation: 'add', value: 0 });
    effectListEditor(container, effects, commit);
    commit();
  });
  container.appendChild(rows);
  container.appendChild(add);
}

/* ==================== 资产页 ==================== */

App.Pages.assets = {
  render(host) {
    const category = host.dataset.category ?? '';
    const sort = host.dataset.sort ?? 'date';
    const sel = host.dataset.selected ? new Set(host.dataset.selected.split(',').filter(Boolean)) : new Set();
    ensureAssetRefs().then(() => {
      if (document.getElementById('page-host').firstChild === host) renderPage();
    });
    let items = App.data.assets.filter((a) => !category || a.category === category);
    items = [...items].sort((a, b) => {
      if (sort === 'ref') return (refCount(b) || 0) - (refCount(a) || 0);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    const cats = ['bg', 'scene', 'standee', 'cg', 'ui', 'bgm', 'se', 'voice', 'video', 'ico'];
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="toolbar" style="margin-top:0;">
            <select id="asset-cat" style="width:auto;flex:1;">
              ${['', ...cats].map((c) => `<option value="${c}"${c === category ? ' selected' : ''}>${c ? categoryLabel(c) : '全部分类'}</option>`).join('')}
            </select>
            <select id="asset-sort" style="width:auto;">
              <option value="date"${sort === 'date' ? ' selected' : ''}>按日期</option>
              <option value="ref"${sort === 'ref' ? ' selected' : ''}>按引用</option>
            </select>
          </div>
          <div class="hint" style="margin:8px 0 4px;">点击勾选框可多选；Ctrl+点击行也可多选</div>
          <div class="list" id="asset-list" style="margin-top:4px;">
            ${items.map((a) => `
              <div class="list-item${a.id === App.cur.assetId ? ' active' : ''}${sel.has(a.id) ? ' multi-selected' : ''}" data-id="${esc(a.id)}">
                <input type="checkbox" class="asset-check" data-id="${esc(a.id)}"${sel.has(a.id) ? ' checked' : ''} title="多选">
                ${esc(a.category.toUpperCase())} | ${esc(a.file_name)}<span class="sub">${esc(a.id)} · 引用 ${refCount(a)}</span>
              </div>`).join('') || '<div class="empty">暂无资产</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="asset-upload">上传资产</button>
            <button class="btn btn-danger" id="asset-del">删除所选</button>
          </div>
        </div>
      </div>
      <div class="vsplit-handle"></div>
      <div class="main" style="display:flex;flex-direction:column;gap:12px;">
        <div class="preview-box" id="asset-preview"></div>
        <div class="panel">${this.detailHtml()}</div>
      </div>
    </div>`;

    host.dataset.category = category;
    host.dataset.sort = sort;
    host.dataset.selected = [...sel].join(',');

    host.querySelector('#asset-cat').addEventListener('change', (e) => { host.dataset.category = e.target.value; renderPage(); });
    host.querySelector('#asset-sort').addEventListener('change', (e) => { host.dataset.sort = e.target.value; renderPage(); });
    host.querySelector('#asset-list').addEventListener('click', (e) => {
      const cb = e.target.closest('.asset-check');
      if (cb) {
        if (cb.checked) sel.add(cb.dataset.id); else sel.delete(cb.dataset.id);
        host.dataset.selected = [...sel].join(',');
        renderPage();
        return;
      }
      const it = e.target.closest('.list-item');
      if (!it) return;
      if (e.ctrlKey || e.metaKey) {
        if (sel.has(it.dataset.id)) sel.delete(it.dataset.id); else sel.add(it.dataset.id);
        host.dataset.selected = [...sel].join(',');
        renderPage();
        return;
      }
      App.cur.assetId = it.dataset.id;
      this.renderDetail(host);
    });
    host.querySelector('#asset-upload').addEventListener('click', async () => {
      await flushCommit();
      const cat = host.dataset.category || 'bg';
      const asset = await call('upload_asset', cat);
      if (!asset) return;
      if (asset.error) { toast(asset.error); return; }
      App.data.assets.push(asset);
      App.cur.assetId = asset.id;
      commit();
      const payload = await call('get_data');
      if (payload) { App.filePath = payload.file_path || App.filePath; }
      renderPage();
    });
    host.querySelector('#asset-del').addEventListener('click', async () => {
      const ids = [...sel];
      if (!ids.length) ids.push(App.cur.assetId);
      ids.forEach((id) => { App.data.assets = App.data.assets.filter((x) => x.id !== id); });
      if (!ids.length) return;
      if (!confirm(`确定删除所选 ${ids.length} 个资产？将同时删除项目中的文件。`)) return;
      await flushCommit();
      for (const id of ids) {
        const ok = await call('delete_asset', id);
        if (!ok) { toast(`删除 ${id} 失败`); }
      }
      const payload = await call('get_data');
      if (payload) { App.filePath = payload.file_path || App.filePath; App.data = payload.data; }
      host.dataset.selected = '';
      App.cur.assetId = App.data.assets.length ? App.data.assets[0].id : '';
      commit();
      renderPage();
    });

    this.renderDetail(host);
    bindSplitters(host);
  },

  renderDetail(host) {
    const a = App.data.assets.find((x) => x.id === App.cur.assetId);
    const box = host.querySelector('#asset-preview');
    box.innerHTML = '';
    const detail = host.querySelector('.main .panel');
    if (!a) {
      detail.innerHTML = '<div class="empty">选择或上传一个资产</div>';
      return;
    }
    call('asset_preview', a.id).then((pre) => {
      if (!pre) { box.textContent = '（无预览或文件缺失）'; return; }
      if (pre.type === 'image') {
        box.innerHTML = `<img src="data:${pre.mime};base64,${pre.data}" alt="预览">`;
      } else if (pre.type === 'audio') {
        box.innerHTML = `<audio controls style="width:100%;max-width:420px;" src="${pre.url}"></audio>`;
      } else if (pre.type === 'video') {
        box.innerHTML = `<video controls style="max-width:100%;max-height:100%;" src="${pre.url}"></video>`;
      } else {
        box.textContent = `资产：${a.file_name}`;
      }
    });
    const cats = ['bg', 'scene', 'standee', 'cg', 'ui', 'bgm', 'se', 'voice', 'video', 'ico'];
    const ref = refInfo(a);
    const refCount = ref ? ref.count : (a.reference_count ?? 0);
    const refLocations = ref ? ref.locations : [];
    detail.innerHTML = `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(a.id)}"></label>
        <label class="field"><span>分类</span><select id="asset-cat-edit">${optionsHtml(cats, '', (c) => categoryLabel(c), a.category)}</select></label>
        <label class="field field-full"><span>文件名（可编辑重命名）</span><input class="input-lg" id="asset-file" value="${esc(a.file_name)}" title="修改后回车或失焦即重命名磁盘文件"></label>
      </div>
      <div class="asset-meta">
        <div class="meta-item"><span>类型</span><em>${esc(a.type)}</em></div>
        <div class="meta-item"><span>引用次数</span><em>${refCount}</em></div>
        <div class="meta-item"><span>上传时间</span><em>${esc(a.created_at)}</em></div>
        <div class="meta-item"><span>相对路径</span><em class="path">${esc(a.rel_path)}</em></div>
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-sm" id="ref-toggle">${refLocations.length ? `引用明细（${refLocations.length}）` : '引用明细'}</button>
        <div id="ref-detail" style="display:none;margin-top:8px;background:#f7f9fc;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px;">
          ${refLocations.length ? refLocations.map((r) => `<div style="padding:2px 0;">${esc(r.location)} — ${esc(r.field)}</div>`).join('') : '<div class="empty" style="padding:8px;">未被引用</div>'}
        </div>
      </div>
      <label class="field" style="margin-top:16px;"><span>标签（逗号分隔）</span><input id="asset-tags" value="${esc((a.tags || []).join(', '))}"></label>`;
    detail.querySelector('#ref-toggle').addEventListener('click', () => {
      const el = detail.querySelector('#ref-detail');
      el.style.display = el.style.display === 'none' ? '' : 'none';
    });
    detail.querySelector('#asset-tags').addEventListener('input', (e) => {
      a.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
      commit();
    });
    const fileInput = detail.querySelector('#asset-file');
    const doRename = async () => {
      const name = fileInput.value.trim();
      if (!name || name === a.file_name) { fileInput.value = a.file_name; return; }
      await flushCommit();
      const res = await call('rename_asset', a.id, name);
      if (res && res.error) { toast(res.error); fileInput.value = a.file_name; return; }
      if (res && res.asset) {
        Object.assign(a, res.asset);
        const payload = await call('get_data');
        if (payload) { App.filePath = payload.file_path || App.filePath; App.data = payload.data; }
        resetAssetRefs();
        toast('已重命名');
        renderPage();
      }
    };
    fileInput.addEventListener('blur', doRename);
    fileInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileInput.blur(); });
    detail.querySelector('#asset-cat-edit').addEventListener('change', async (e) => {
      await flushCommit();
      const ok = await call('change_asset_category', a.id, e.target.value);
      if (!ok) { toast('分类修改失败'); e.target.value = a.category; return; }
      host.dataset.category = e.target.value;
      const payload = await call('get_data');
      if (payload) { App.filePath = payload.file_path || App.filePath; App.data = payload.data; }
      renderPage();
    });
  },

  detailHtml() { return '<div class="empty">选择或上传一个资产</div>'; },
};

/* 资产引用信息（缓存于前端状态，由后端分析一次） */
let _assetRefsCache = null;
async function ensureAssetRefs() {
  if (_assetRefsCache === null) {
    try { _assetRefsCache = await call('asset_references'); } catch (e) { _assetRefsCache = {}; }
  }
  return _assetRefsCache || {};
}
function resetAssetRefs() {
  _assetRefsCache = null;
}
function refInfo(asset) {
  return (_assetRefsCache || {})[asset.id] || null;
}
function refCount(asset) {
  return (refInfo(asset) || {}).count ?? (asset.reference_count ?? 0);
}

/* ==================== AI 页（语音） ==================== */

App.Pages.ai = {
  render(host) {
    const chars = App.data.characters || [];
    const scripts = App.data.scripts || [];
    host.innerHTML = `
    <div class="vstack" style="max-width:1000px;">
      <div class="panel">
        <div class="panel-title">角色 → 音色映射</div>
        <p class="hint" style="margin-bottom:12px;">为每个角色指定一个合成声线，生成时自动按角色路由。<br>
          声线来自微软 Edge 在线 TTS（edge-tts），免费、无需 API Key。下方下拉框为空表示该角色暂不生成语音。</p>
        <table class="data">
          <thead><tr><th style="width:30%">角色</th><th>声线</th></tr></thead>
          <tbody>
            <tr>
              <td>旁白<span class="sub">（无角色对话）</span></td>
              <td><select class="ai-voice-select" data-char="__narration__"></select></td>
            </tr>
            ${chars.map((c) => `
              <tr>
                <td>${esc(c.name)}<span class="sub">${esc(c.id)}</span></td>
                <td><select class="ai-voice-select" data-char="${esc(c.id)}"></select></td>
              </tr>`).join('') || '<tr><td colspan="2" class="empty">暂无角色，请先在「角色」页创建。</td></tr>'}
          </tbody>
        </table>
        <div class="toolbar" style="margin-top:12px;">
          <button class="btn btn-sm" id="ai-refresh-voices">刷新声线列表</button>
          <span class="hint" style="margin-left:10px;" id="ai-voice-count"></span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">批量生成语音</div>
        <label class="field" style="max-width:340px;"><span>生成范围</span>
          <select id="ai-scope">
            <option value="">全部剧情</option>
            ${scripts.map((s) => `<option value="${esc(s.id)}">${esc(s.id)}</option>`).join('')}
          </select>
        </label>
        <label class="field" style="max-width:340px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="ai-overwrite" style="width:auto;transform:scale(1.2);">
          <span style="margin:0;">覆盖已有语音（未勾选时仅补生成缺失的语音）</span>
        </label>
        <div class="toolbar">
          <button class="btn btn-success" id="ai-generate">开始生成</button>
        </div>
        <div id="ai-result" style="margin-top:14px;"></div>
        <div id="ai-progress" style="margin-top:16px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
            <span id="ai-progress-label">生成中…</span>
            <span id="ai-progress-pct">0%</span>
          </div>
          <div class="progress-track"><div id="ai-progress-fill" class="progress-fill" style="width:0%;"></div></div>
        </div>
        <div id="ai-log" style="margin-top:12px;display:none;">
          <div class="panel-title">生成日志</div>
          <pre id="ai-log-body" style="background:#14171e;color:#c9d4e3;border-radius:8px;padding:12px;max-height:300px;overflow:auto;font-size:12px;line-height:1.6;white-space:pre-wrap;"></pre>
        </div>
      </div>
    </div>`;

    this._loadVoices(host);
    host.querySelector('#ai-refresh-voices').addEventListener('click', () => this._loadVoices(host, true));
    host.querySelector('#ai-generate').addEventListener('click', () => this.startGenerate(host));
  },

  async _loadVoices(host, force) {
    let voices = App.aiVoices;
    if (force || !voices) {
      try {
        voices = await call('ai_list_voices', !!force);
      } catch (e) {
        voices = [];
      }
      App.aiVoices = voices;
    }
    if (!Array.isArray(voices)) voices = [];
    const count = host.querySelector('#ai-voice-count');
    if (count) count.textContent = voices.length ? `共 ${voices.length} 个可用声线` : '（未获取到声线，请检查网络）';

    let map = {};
    try {
      map = (await call('ai_load_voice_map')) || {};
    } catch (e) { /* 忽略 */ }

    host.querySelectorAll('.ai-voice-select').forEach((sel) => {
      const charId = sel.dataset.char;
      const current = map[charId] || '';
      const opts = ['', ...voices.map((v) => v.id)].map((id) => {
        const label = id ? (voices.find((v) => v.id === id)?.name || id) : '（不生成）';
        return `<option value="${esc(id)}"${id === current ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('');
      sel.innerHTML = opts;
      sel.addEventListener('change', async (e) => {
        const value = e.target.value;
        map[charId] = value;
        const ok = await call('ai_save_voice_map', map);
        if (ok) { toast(`已为「${App.data.characters.find((c) => c.id === charId)?.name || charId}」设置声线`); }
        else { toast('保存声线映射失败：请先保存项目'); }
      });
    });
  },

  async startGenerate(host) {
    await flushCommit();
    const overwrite = host.querySelector('#ai-overwrite').checked;
    const scope = host.querySelector('#ai-scope').value;
    const res = await call('ai_voice_generate', overwrite, scope);
    if (res && res.error) { toast(res.error); return; }
    const logEl = host.querySelector('#ai-log');
    logEl.style.display = '';
    host.querySelector('#ai-log-body').textContent = '';
    host.querySelector('#ai-result').innerHTML = '';
    const bar = host.querySelector('#ai-progress');
    bar.style.display = '';
    host.querySelector('#ai-progress-fill').style.width = '0%';
    host.querySelector('#ai-progress-pct').textContent = '0%';
    this._pollGenerate(host);
  },

  async _pollGenerate(host) {
    const st = await call('ai_voice_status');
    const body = host.querySelector('#ai-log-body');
    if (st.logs && st.logs.length) body.textContent = st.logs.join('\n');
    body.scrollTop = body.scrollHeight;
    const fill = host.querySelector('#ai-progress-fill');
    const pct = Math.round((st.progress || 0) * 100);
    fill.style.width = pct + '%';
    host.querySelector('#ai-progress-pct').textContent = pct + '%';
    if (st.last) host.querySelector('#ai-progress-label').textContent = st.last;
    if (!st.done) {
      setTimeout(() => this._pollGenerate(host), 700);
      return;
    }
    if (st.ok) fill.style.width = '100%';
    const resultBox = host.querySelector('#ai-result');
    if (st.ok) {
      resultBox.innerHTML = `
        <div class="panel" style="background:#effaf2;border-color:#cdeedd;">
          <b>生成完成</b>：新增 ${st.generated ?? 0} 条${st.skipped ? `，跳过 ${st.skipped} 条` : ''}
          ${(st.errors && st.errors.length) ? `<div class="hint" style="margin-top:6px;">${st.errors.length} 条失败（详见日志）</div>` : ''}
        </div>`;
      const payload = await call('get_data');
      if (payload) {
        App.filePath = payload.file_path || App.filePath;
        App.data = payload.data;
      }
      updateHeader();
    } else {
      resultBox.innerHTML = `
        <div class="panel" style="background:#fff3f3;border-color:#f5c6c6;">
          <b>生成失败</b>
          <pre style="white-space:pre-wrap;margin-top:8px;color:#c0392b;font-size:12px;">${esc((st.errors || []).join('\n'))}</pre>
        </div>`;
    }
  },
};

/* ==================== 设置页 ==================== */

App.Pages.settings = {
  render(host) {
    const p = App.data.project;
    const d = p.defaults;
    p.version_major = p.version_major ?? 1;
    p.version_minor = p.version_minor ?? 0;
    p.version_patch = p.version_patch ?? 0;
    host.innerHTML = `
    <div class="panel" style="max-width:900px;">
      <div class="panel-title">项目信息</div>
      <div class="field-grid">
        <label class="field"><span>项目名称</span><input class="input-lg" id="set-name" value="${esc(p.name)}"></label>
        <label class="field field-grid-inner"><span>版本号（总.大.小）</span>
          <div class="ver-controls">
            <input class="ver-input" id="ver-major" type="number" min="0" value="${p.version_major}" title="总版本">
            <span class="ver-dot">.</span>
            <input class="ver-input" id="ver-minor" type="number" min="0" value="${p.version_minor}" title="大版本">
            <span class="ver-dot">.</span>
            <input class="ver-input" id="ver-patch" type="number" min="0" value="${p.version_patch}" title="小版本">
          </div>
        </label>
        <label class="field"><span>作者</span><input id="set-author" value="${esc(p.author)}"></label>
        <label class="field field-full"><span>项目简介</span><textarea id="set-desc" class="desc-textarea">${esc(p.description)}</textarea></label>
      </div>
      <div class="divider"></div>
      <div class="panel-title">版本自动递增</div>
      <div class="field-grid">
        <label class="field toggle-field"><span>保存时自动递增小版本</span>
          <input type="checkbox" id="set-auto-patch" ${p.auto_patch_on_save === false ? '' : 'checked'} style="width:auto;transform:scale(1.2);">
        </label>
        <label class="field toggle-field"><span>生成 exe 时自动递增大版本</span>
          <input type="checkbox" id="set-auto-minor" ${p.auto_minor_on_build === false ? '' : 'checked'} style="width:auto;transform:scale(1.2);">
        </label>
      </div>
      <div class="divider"></div>
      <div class="panel-title">生成配置</div>
      <div class="field-grid">
        <label class="field"><span>exe 图标（ico 资产）</span><select id="set-icon">${optionsHtml(App.data.assets.filter((a) => a.category === 'ico'), 'id', (a) => `${a.file_name} (${a.id})`, p.exe_icon || '', '(默认)')}</select></label>
      </div>
      <div class="divider"></div>
      <div class="panel-title">游戏端默认配置</div>
      <div class="field-grid">
        <label class="field"><span>文字速度（字/秒）</span><input type="number" id="set-speed" value="${d.text_speed}" min="1" max="300"></label>
        <label class="field"><span>自动阅读等待（秒）</span><input type="number" id="set-auto" value="${d.auto_advance_delay}" min="0.5" max="60" step="0.5"></label>
        <label class="field"><span>中文字体</span><select id="set-font-cn" class="set-font-select"></select></label>
        <label class="field"><span>英文及数字字体</span><select id="set-font-en" class="set-font-select"></select></label>
        <label class="field"><span>默认字号</span><input type="number" id="set-fontsize" value="${d.font_size}" min="8" max="96"></label>
        <label class="field"><span>窗口宽度</span><input type="number" id="set-width" value="${d.window_width}" min="320"></label>
        <label class="field"><span>窗口高度</span><input type="number" id="set-height" value="${d.window_height}" min="240"></label>
      </div>
      <div class="hint" style="margin-top:10px;">以上配置写入 .gg 文件的 project.defaults，供游戏端读取。</div>
    </div>`;

    const f = host.querySelector('.panel');
    const bind = (id, fn) => f.querySelector(id).addEventListener('input', fn);
    bind('#set-name', (e) => { p.name = e.target.value; commit(); });
    bind('#set-author', (e) => { p.author = e.target.value; commit(); });
    bind('#set-desc', (e) => { p.description = e.target.value; commit(); });
    bind('#set-speed', (e) => { d.text_speed = parseInt(e.target.value, 10) || 30; commit(); });
    bind('#set-auto', (e) => { d.auto_advance_delay = parseFloat(e.target.value) || 3; commit(); });
    bind('#set-fontsize', (e) => { d.font_size = parseInt(e.target.value, 10) || 24; commit(); });
    bind('#set-width', (e) => { d.window_width = parseInt(e.target.value, 10) || 1280; commit(); });
    bind('#set-height', (e) => { d.window_height = parseInt(e.target.value, 10) || 720; commit(); });
    const iconSel = f.querySelector('#set-icon');
    if (iconSel) iconSel.addEventListener('change', (e) => { p.exe_icon = e.target.value; commit(); });

    // 版本号：分栏输入 + 按钮调整
    const syncVerInputs = () => {
      f.querySelector('#ver-major').value = p.version_major;
      f.querySelector('#ver-minor').value = p.version_minor;
      f.querySelector('#ver-patch').value = p.version_patch;
    };
    const applyVer = () => {
      p.version_major = Math.max(0, parseInt(f.querySelector('#ver-major').value, 10) || 0);
      p.version_minor = Math.max(0, parseInt(f.querySelector('#ver-minor').value, 10) || 0);
      p.version_patch = Math.max(0, parseInt(f.querySelector('#ver-patch').value, 10) || 0);
      p.sync_version = p.sync_version || ((v) => v.version = `${v.version_major}.${v.version_minor}.${v.version_patch}`);
      p.sync_version(p);
      commit();
    };
    ['major', 'minor', 'patch'].forEach((v) => {
      f.querySelector(`#ver-${v}`).addEventListener('input', applyVer);
    });

    // 自动递增开关
    f.querySelector('#set-auto-patch').addEventListener('change', (e) => { p.auto_patch_on_save = e.target.checked; commit(); });
    f.querySelector('#set-auto-minor').addEventListener('change', (e) => { p.auto_minor_on_build = e.target.checked; commit(); });

    // 字体下拉框（中文前置）
    call('list_fonts').then((fonts) => {
      const cn = fonts?.cn || [];
      const en = fonts?.en || [];
      const fill = (selId, current, list) => {
        const sel = f.querySelector(selId);
        if (!sel) return;
        const opts = list.length ? list : [current || '微软雅黑'];
        sel.innerHTML = opts.map((name) => `<option value="${esc(name)}"${name === current ? ' selected' : ''}>${esc(name)}</option>`).join('');
      };
      fill('#set-font-cn', d.font_cn || '微软雅黑', cn);
      fill('#set-font-en', d.font_en || 'Microsoft YaHei', en);
      f.querySelector('#set-font-cn').addEventListener('change', (e) => { d.font_cn = e.target.value; commit(); });
      f.querySelector('#set-font-en').addEventListener('change', (e) => { d.font_en = e.target.value; commit(); });
    });
  },
};

/* ==================== 生成页 ==================== */

App.Pages.build = {
  render(host) {
    host.innerHTML = `
    <div class="panel" style="max-width:900px;">
      <div class="panel-title">生成</div>
      <p style="margin-bottom:14px;">一键生成游戏端 <b>.exe</b>。首次生成前请先保存项目，并建议先「校验项目」。<br>
        <span class="hint">当前版本 <b id="build-ver">${esc(App.data.project.version || '1.0.0')}</b>，生成后将自动递增大版本（如 1.0.0 → 1.1.0）。</span>
      </p>
      <label class="field" style="max-width:340px;"><span>产物形态</span>
        <select id="build-mode">
          <option value="1">单文件（.exe）</option>
          <option value="0">目录（onedir）</option>
        </select>
      </label>
      <div class="toolbar">
        <button class="btn" id="build-validate">校验项目</button>
        <button class="btn btn-success" id="build-go">一键生成 .exe</button>
      </div>
      <div id="build-result" style="margin-top:16px;"></div>
      <div id="build-progress" style="margin-top:16px;display:none;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          <span id="build-progress-label">构建中…</span>
          <span id="build-progress-pct">0%</span>
        </div>
        <div class="progress-track"><div id="build-progress-fill" class="progress-fill" style="width:0%;"></div></div>
      </div>
      <div id="build-log" style="margin-top:12px;display:none;">
        <div class="panel-title">构建日志</div>
        <pre id="build-log-body" style="background:#14171e;color:#c9d4e3;border-radius:8px;padding:12px;max-height:300px;overflow:auto;font-size:12px;line-height:1.6;white-space:pre-wrap;"></pre>
      </div>
    </div>`;
    host.querySelector('#build-validate').addEventListener('click', async () => {
      await flushCommit();
      const issues = await call('validate');
      this.renderValidation(issues);
    });
    host.querySelector('#build-go').addEventListener('click', () => this.startBuild(host));
  },

  async startBuild(host) {
    await flushCommit();
    const onefile = host.querySelector('#build-mode').value === '1';
    const res = await call('build_start', onefile);
    if (res && res.error) { toast(res.error); return; }
    const logEl = host.querySelector('#build-log');
    logEl.style.display = '';
    host.querySelector('#build-log-body').textContent = '';
    host.querySelector('#build-result').innerHTML = '';
    const bar = host.querySelector('#build-progress');
    bar.style.display = '';
    host.querySelector('#build-progress-fill').style.width = '0%';
    host.querySelector('#build-progress-pct').textContent = '0%';
    this._pollBuild(host);
  },

  async _pollBuild(host) {
    const st = await call('build_status');
    const body = host.querySelector('#build-log-body');
    if (st.logs && st.logs.length) body.textContent = st.logs.join('\n');
    body.scrollTop = body.scrollHeight;
    const fill = host.querySelector('#build-progress-fill');
    const pct = Math.round((st.progress || 0) * 100);
    fill.style.width = pct + '%';
    host.querySelector('#build-progress-pct').textContent = pct + '%';
    if (st.last) host.querySelector('#build-progress-label').textContent = st.last;
    if (!st.done) {
      setTimeout(() => this._pollBuild(host), 800);
      return;
    }
    if (st.ok) fill.style.width = '100%';
    const resultBox = host.querySelector('#build-result');
    if (st.ok) {
      resultBox.innerHTML = `
        <div class="panel" style="background:#effaf2;border-color:#cdeedd;">
          <b>生成成功</b>
          <div style="margin-top:8px;word-break:break-all;">${esc(st.exe)}</div>
          <div class="toolbar">
            <button class="btn btn-primary" id="open-dir">打开所在目录</button>
          </div>
        </div>`;
      host.querySelector('#open-dir').addEventListener('click', () => call('open_explorer', st.exe));
    } else {
      resultBox.innerHTML = `
        <div class="panel" style="background:#fff3f3;border-color:#f5c6c6;">
          <b>生成失败</b>
          <pre style="white-space:pre-wrap;margin-top:8px;color:#c0392b;font-size:12px;">${esc((st.errors || []).join('\n'))}</pre>
        </div>`;
    }
  },

  renderValidation(issues) {
    const host = document.getElementById('page-host');
    const box = host.querySelector('#build-result');
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (!issues.length) {
      box.innerHTML = '<div class="panel" style="background:#effaf2;border-color:#cdeedd;"><b>校验通过</b>，未发现问题。</div>';
      return;
    }
    box.innerHTML = `
      <div class="panel">
        <b>发现 ${errors.length} 个错误、${warnings.length} 个警告</b>
        <ul class="issue-list" style="margin-top:10px;">
          ${issues.map((i) => `<li><span class="sev ${i.severity}">${i.severity === 'error' ? '错误' : '警告'}</span>${esc(i.location)}：${esc(i.message)}</li>`).join('')}
        </ul>
      </div>`;
  },
};
