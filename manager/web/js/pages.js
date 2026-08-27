/* GalGen 管理器前端页面。 */

/* ==================== 通用 KV 编辑器 ==================== */

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
    <div class="hsplit">
      <div class="side">
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
      <div class="main panel" style="overflow:auto;" id="char-form">${this.formHtml()}</div>
    </div>`;

    const list = host.querySelector('#char-list');
    list.addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.characterId = it.dataset.id; renderPage(); }
    });
    host.querySelector('#char-add').addEventListener('click', async () => {
      const id = await call('next_id', 'characters');
      App.data.characters.push({ id, name: '新角色', description: '', personality: '', variables: {}, constants: {}, default_standee: '', expressions: {}, voice: '' });
      App.cur.characterId = id;
      commit();
      renderPage();
    });
    host.querySelector('#char-del').addEventListener('click', () => {
      const c = App.data.characters.find((x) => x.id === App.cur.characterId);
      if (!c) return;
      if (!confirm(`确定删除角色「${c.name}」？`)) return;
      App.data.characters = App.data.characters.filter((x) => x.id !== c.id);
      App.cur.characterId = '';
      commit();
      renderPage();
    });
    this.bindForm(host);
  },

  formHtml() {
    const c = App.data.characters.find((x) => x.id === App.cur.characterId);
    if (!c) return '<div class="empty">选择或新建一个角色</div>';
    const standees = filterByCategory(App.data.assets, 'standee');
    const voices = filterByCategory(App.data.assets, 'voice');
    return `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(c.id)}"></label>
        <label class="field"><span>名称</span><input class="input-lg" id="c-name" value="${esc(c.name)}"></label>
        <label class="field"><span>默认立绘</span><select id="c-standee">${optionsHtml(standees, 'id', (a) => `${a.file_name} (${a.id})`, c.default_standee, '(无)')}</select></label>
        <label class="field"><span>默认语音</span><select id="c-voice">${optionsHtml(voices, 'id', (a) => `${a.file_name} (${a.id})`, c.voice, '(无)')}</select></label>
        <label class="field field-full"><span>简介</span><textarea id="c-desc">${esc(c.description)}</textarea></label>
        <label class="field field-full"><span>性格说明</span><textarea id="c-personality">${esc(c.personality)}</textarea></label>
        <div class="field field-full"><span>变量（如好感度）</span><div id="c-variables"></div></div>
        <div class="field field-full"><span>常量（年龄、生日等）</span><div id="c-constants"></div></div>
        <div class="field field-full"><span>表情 → 立绘</span><div id="c-expressions"></div></div>
      </div>`;
  },

  bindForm(host) {
    const c = App.data.characters.find((x) => x.id === App.cur.characterId);
    if (!c) return;
    const f = host.querySelector('#char-form');
    f.querySelector('#c-name').addEventListener('input', (e) => { c.name = e.target.value; commit(); });
    f.querySelector('#c-desc').addEventListener('input', (e) => { c.description = e.target.value; commit(); });
    f.querySelector('#c-personality').addEventListener('input', (e) => { c.personality = e.target.value; commit(); });
    f.querySelector('#c-standee').addEventListener('change', (e) => { c.default_standee = e.target.value; commit(); });
    f.querySelector('#c-voice').addEventListener('change', (e) => { c.voice = e.target.value; commit(); });
    kvEditor(f.querySelector('#c-variables'), c.variables, '变量');
    kvEditor(f.querySelector('#c-constants'), c.constants, '常量');
    kvEditor(f.querySelector('#c-expressions'), c.expressions, '表情');
  },
};

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
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    host.querySelector('#scene-list').addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.sceneId = it.dataset.id; renderPage(); }
    });
    host.querySelector('#scene-add').addEventListener('click', async () => {
      const id = await call('next_id', 'scenes');
      App.data.scenes.push({ id, name: '新场景', background: '', description: '' });
      App.cur.sceneId = id;
      commit();
      renderPage();
    });
    host.querySelector('#scene-del').addEventListener('click', () => {
      const s = App.data.scenes.find((x) => x.id === App.cur.sceneId);
      if (!s) return;
      if (!confirm(`确定删除场景「${s.name}」？`)) return;
      App.data.scenes = App.data.scenes.filter((x) => x.id !== s.id);
      App.cur.sceneId = '';
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
          <div class="hint" style="margin-bottom:8px;">拖动列表项可调整章节顺序</div>
          <div class="list" id="chapter-list">
            ${chapters.map((c) => `
              <div class="list-item${c.id === App.cur.chapterId ? ' active' : ''}" data-id="${esc(c.id)}" draggable="true">
                ${esc(c.name)}<span class="sub">${esc(c.id)}</span>
              </div>`).join('') || '<div class="empty">暂无章节</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="chapter-add">新建章节</button>
            <button class="btn btn-danger" id="chapter-del">删除章节</button>
          </div>
        </div>
      </div>
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    host.querySelector('#chapter-list').addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.chapterId = it.dataset.id; renderPage(); }
    });
    this.bindDragReorder(host);
    host.querySelector('#chapter-add').addEventListener('click', async () => {
      const id = await call('next_id', 'chapters');
      App.data.chapters.push({ id, name: '新章节', order: App.data.chapters.length + 1, start_script: '', branches: [] });
      App.cur.chapterId = id;
      commit();
      renderPage();
    });
    host.querySelector('#chapter-del').addEventListener('click', () => {
      const c = App.data.chapters.find((x) => x.id === App.cur.chapterId);
      if (!c) return;
      if (!confirm(`确定删除章节「${c.name}」？`)) return;
      App.data.chapters = App.data.chapters.filter((x) => x.id !== c.id);
      App.cur.chapterId = '';
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
    let dragId = null;

    list.addEventListener('dragstart', (e) => {
      const it = e.target.closest('.list-item');
      if (!it) return;
      dragId = it.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      it.classList.add('dragging');
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragId) return;
      e.dataTransfer.dropEffect = 'move';
      const over = e.target.closest('.list-item');
      if (!over || over.dataset.id === dragId) return;
      const dragged = list.querySelector(`.list-item[data-id="${CSS.escape(dragId)}"]`);
      const box = over.getBoundingClientRect();
      if (e.clientY > box.top + box.height / 2) {
        if (over.nextSibling !== dragged) list.insertBefore(dragged, over.nextSibling);
      } else if (over !== dragged) {
        list.insertBefore(dragged, over);
      }
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      dragId = null;
      const ids = [...list.querySelectorAll('.list-item')].map((it) => it.dataset.id);
      const byId = {};
      App.data.chapters.forEach((c) => { byId[c.id] = c; });
      App.data.chapters = ids.map((id, i) => {
        const c = byId[id];
        if (c) c.order = i + 1;
        return c;
      });
      commit();
      renderPage();
    });

    list.addEventListener('dragend', () => {
      list.querySelectorAll('.list-item').forEach((it) => it.classList.remove('dragging'));
      dragId = null;
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
          <div class="list" id="ending-list">
            ${endings.map((e) => `
              <div class="list-item${e.id === App.cur.endingId ? ' active' : ''}" data-id="${esc(e.id)}">
                ${esc(e.name)}<span class="sub">${esc(e.id)} · ${esc(e.ending_type)}${e.is_hidden ? ' · 隐藏' : ''}</span>
              </div>`).join('') || '<div class="empty">暂无结局</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="ending-add">新建结局</button>
            <button class="btn btn-danger" id="ending-del">删除结局</button>
          </div>
        </div>
      </div>
      <div class="main panel" style="overflow:auto;">
        ${this.formHtml()}
      </div>
    </div>`;

    host.querySelector('#ending-list').addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.endingId = it.dataset.id; renderPage(); }
    });
    host.querySelector('#ending-add').addEventListener('click', async () => {
      const id = await call('next_id', 'endings');
      App.data.endings.push({ id, name: '新结局', ending_type: 'good', description: '', cg: '', is_hidden: false });
      App.cur.endingId = id;
      commit();
      renderPage();
    });
    host.querySelector('#ending-del').addEventListener('click', () => {
      const e = App.data.endings.find((x) => x.id === App.cur.endingId);
      if (!e) return;
      if (!confirm(`确定删除结局「${e.name}」？`)) return;
      App.data.endings = App.data.endings.filter((x) => x.id !== e.id);
      App.cur.endingId = '';
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

/* ==================== 资产页 ==================== */

App.Pages.assets = {
  render(host) {
    const category = host.dataset.category ?? '';
    const sort = host.dataset.sort ?? 'date';
    let items = App.data.assets.filter((a) => !category || a.category === category);
    items = [...items].sort((a, b) => {
      if (sort === 'ref') return (b.reference_count || 0) - (a.reference_count || 0);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    const cats = ['bg', 'scene', 'standee', 'cg', 'ui', 'bgm', 'se', 'voice', 'video'];
    host.innerHTML = `
    <div class="hsplit">
      <div class="side">
        <div class="panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="toolbar" style="margin-top:0;">
            <select id="asset-cat" style="width:auto;flex:1;">
              ${['', ...cats].map((c) => `<option value="${c}"${c === category ? ' selected' : ''}>${c ? c.toUpperCase() : '全部分类'}</option>`).join('')}
            </select>
            <select id="asset-sort" style="width:auto;">
              <option value="date"${sort === 'date' ? ' selected' : ''}>按日期</option>
              <option value="ref"${sort === 'ref' ? ' selected' : ''}>按引用</option>
            </select>
          </div>
          <div class="list" id="asset-list" style="margin-top:10px;">
            ${items.map((a) => `
              <div class="list-item${a.id === App.cur.assetId ? ' active' : ''}" data-id="${esc(a.id)}">
                ${esc(a.category.toUpperCase())} | ${esc(a.file_name)}<span class="sub">${esc(a.id)} · 引用 ${a.reference_count ?? 0}</span>
              </div>`).join('') || '<div class="empty">暂无资产</div>'}
          </div>
          <div class="toolbar stretch-btns">
            <button class="btn btn-primary" id="asset-upload">上传资产</button>
            <button class="btn btn-danger" id="asset-del">删除资产</button>
          </div>
        </div>
      </div>
      <div class="main" style="display:flex;flex-direction:column;gap:12px;">
        <div class="preview-box" id="asset-preview"></div>
        <div class="panel">${this.detailHtml()}</div>
      </div>
    </div>`;

    host.dataset.category = category;
    host.dataset.sort = sort;

    host.querySelector('#asset-cat').addEventListener('change', (e) => { host.dataset.category = e.target.value; renderPage(); });
    host.querySelector('#asset-sort').addEventListener('change', (e) => { host.dataset.sort = e.target.value; renderPage(); });
    host.querySelector('#asset-list').addEventListener('click', (e) => {
      const it = e.target.closest('.list-item');
      if (it) { App.cur.assetId = it.dataset.id; this.renderDetail(host); }
    });
    host.querySelector('#asset-upload').addEventListener('click', async () => {
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
      const a = App.data.assets.find((x) => x.id === App.cur.assetId);
      if (!a) return;
      if (!confirm(`确定删除资产「${a.file_name}」？将同时删除项目中的文件。`)) return;
      const ok = await call('delete_asset', a.id);
      if (!ok) return;
      App.data.assets = App.data.assets.filter((x) => x.id !== a.id);
      App.cur.assetId = '';
      commit();
      renderPage();
    });

    this.renderDetail(host);
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
    if (a.type === 'image') {
      call('asset_preview', a.id).then((pre) => {
        if (pre) {
          box.innerHTML = `<img src="data:${pre.mime};base64,${pre.data}" alt="预览">`;
        } else {
          box.textContent = '（无预览）';
        }
      });
    } else {
      box.textContent = `音频 / 视频资产：${a.file_name}`;
    }
    const cats = ['bg', 'scene', 'standee', 'cg', 'ui', 'bgm', 'se', 'voice', 'video'];
    detail.innerHTML = `
      <div class="field-grid">
        <label class="field"><span>ID</span><input class="input-lg" readonly value="${esc(a.id)}"></label>
        <label class="field"><span>分类</span><select id="asset-cat-edit">${optionsHtml(cats, '', (c) => c, a.category)}</select></label>
        <label class="field field-full"><span>文件名</span><input class="input-lg" readonly value="${esc(a.file_name)}"></label>
      </div>
      <div class="asset-meta">
        <div class="meta-item"><span>类型</span><em>${esc(a.type)}</em></div>
        <div class="meta-item"><span>引用次数</span><em>${a.reference_count ?? 0}</em></div>
        <div class="meta-item"><span>上传时间</span><em>${esc(a.created_at)}</em></div>
        <div class="meta-item"><span>相对路径</span><em class="path">${esc(a.rel_path)}</em></div>
      </div>
      <label class="field" style="margin-top:16px;"><span>标签（逗号分隔）</span><input id="asset-tags" value="${esc((a.tags || []).join(', '))}"></label>`;
    detail.querySelector('#asset-tags').addEventListener('input', (e) => {
      a.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
      commit();
    });
    detail.querySelector('#asset-cat-edit').addEventListener('change', async (e) => {
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

/* ==================== 设置页 ==================== */

App.Pages.settings = {
  render(host) {
    const p = App.data.project;
    const d = p.defaults;
    host.innerHTML = `
    <div class="panel" style="max-width:900px;">
      <div class="panel-title">项目信息</div>
      <div class="field-grid">
        <label class="field"><span>项目名称</span><input class="input-lg" id="set-name" value="${esc(p.name)}"></label>
        <label class="field"><span>版本号</span><input id="set-version" value="${esc(p.version)}"></label>
        <label class="field"><span>作者</span><input id="set-author" value="${esc(p.author)}"></label>
        <label class="field field-full"><span>项目简介</span><textarea id="set-desc">${esc(p.description)}</textarea></label>
      </div>
      <div class="divider"></div>
      <div class="panel-title">游戏端默认配置</div>
      <div class="field-grid">
        <label class="field"><span>文字速度（字/秒）</span><input type="number" id="set-speed" value="${d.text_speed}" min="1" max="300"></label>
        <label class="field"><span>自动阅读等待（秒）</span><input type="number" id="set-auto" value="${d.auto_advance_delay}" min="0.5" max="60" step="0.5"></label>
        <label class="field"><span>默认字体</span><input id="set-font" value="${esc(d.font)}"></label>
        <label class="field"><span>默认字号</span><input type="number" id="set-fontsize" value="${d.font_size}" min="8" max="96"></label>
        <label class="field"><span>窗口宽度</span><input type="number" id="set-width" value="${d.window_width}" min="320"></label>
        <label class="field"><span>窗口高度</span><input type="number" id="set-height" value="${d.window_height}" min="240"></label>
      </div>
      <div class="hint" style="margin-top:10px;">以上配置写入 .gg 文件的 project.defaults，供游戏端读取。</div>
    </div>`;

    const f = host.querySelector('.panel');
    const bind = (id, fn) => f.querySelector(id).addEventListener('input', fn);
    bind('#set-name', (e) => { p.name = e.target.value; commit(); });
    bind('#set-version', (e) => { p.version = e.target.value; commit(); });
    bind('#set-author', (e) => { p.author = e.target.value; commit(); });
    bind('#set-desc', (e) => { p.description = e.target.value; commit(); });
    bind('#set-speed', (e) => { d.text_speed = parseInt(e.target.value, 10) || 30; commit(); });
    bind('#set-auto', (e) => { d.auto_advance_delay = parseFloat(e.target.value) || 3; commit(); });
    bind('#set-font', (e) => { d.font = e.target.value; commit(); });
    bind('#set-fontsize', (e) => { d.font_size = parseInt(e.target.value, 10) || 24; commit(); });
    bind('#set-width', (e) => { d.window_width = parseInt(e.target.value, 10) || 1280; commit(); });
    bind('#set-height', (e) => { d.window_height = parseInt(e.target.value, 10) || 720; commit(); });
  },
};

/* ==================== 生成页 ==================== */

App.Pages.build = {
  render(host) {
    host.innerHTML = `
    <div class="panel" style="max-width:900px;">
      <div class="panel-title">生成</div>
      <p style="margin-bottom:14px;">一键生成游戏端 <b>.exe</b>。首次生成前请先保存项目，并建议先「校验项目」。</p>
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
      const issues = await call('validate');
      this.renderValidation(issues);
    });
    host.querySelector('#build-go').addEventListener('click', () => this.startBuild(host));
  },

  async startBuild(host) {
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
