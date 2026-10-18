/* 应用主逻辑：数据加载/保存、面板、缩放、添加板块、导入导出 */
(function () {
  const App = window.App;
  const U = App.util;
  const { h, icon, toast, debounce, clamp } = U;
  const KEY = 'resume-studio:data';
  const DEFAULT_DATA_PATH = 'data/resume.json';

  App.dataPath = DEFAULT_DATA_PATH;

  const state = (App.state = {
    data: null,
    activeSection: null,
    selectedSticker: null,
    zoom: 1,
    fitMode: true,
    lastSaved: null,
    save: { local: false, server: false, retrying: false, warned: false },
  });

  let serviceConnected = null;

  const history = (App.history = {
    stack: [],
    index: -1,
    limit: 40,
    timer: 0,
    suspended: false,
  });

  function currentSnapshot() {
    return state.data ? JSON.stringify(state.data) : '';
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (!undoBtn || !redoBtn) return;
    const current = currentSnapshot();
    const atTop = history.index >= 0 && history.stack[history.index] === current;
    const canUndo = history.index > 0 || (history.index >= 0 && !atTop);
    const canRedo = atTop && history.index < history.stack.length - 1;
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
  }

  function pushSnapshot(snapshot) {
    if (history.suspended || !snapshot) return;
    if (history.index >= 0 && history.stack[history.index] === snapshot) {
      updateHistoryButtons();
      return;
    }
    if (history.index < history.stack.length - 1) {
      history.stack = history.stack.slice(0, history.index + 1);
    }
    history.stack.push(snapshot);
    if (history.stack.length > history.limit) history.stack.shift();
    history.index = history.stack.length - 1;
    updateHistoryButtons();
  }

  function scheduleHistory() {
    clearTimeout(history.timer);
    history.timer = setTimeout(() => pushSnapshot(currentSnapshot()), 550);
  }

  function resetHistory() {
    clearTimeout(history.timer);
    history.stack = state.data ? [currentSnapshot()] : [];
    history.index = history.stack.length ? 0 : -1;
    updateHistoryButtons();
  }

  function applyHistory(snapshot, label) {
    history.suspended = true;
    clearTimeout(history.timer);
    try {
      state.data = App.data.normalize(JSON.parse(snapshot));
      state.activeSection = null;
      state.selectedSticker = null;
      closePanel();
      document.querySelectorAll('.page-pop').forEach((el) => el.remove());
      App.render.page();
      App.render.outline();
      if (typeof syncGuideBtn === 'function') syncGuideBtn();
      if (typeof updateScale === 'function') updateScale();
      state.scheduleSave({ history: false });
    } catch (err) {
      toast('历史记录读取失败', { error: true });
    } finally {
      history.suspended = false;
      updateHistoryButtons();
    }
    if (label) toast(label);
  }

  function undo() {
    if (history.suspended || !state.data || history.index < 0) return;
    const current = currentSnapshot();
    if (history.stack[history.index] !== current) pushSnapshot(current);
    if (history.index <= 0) {
      updateHistoryButtons();
      return;
    }
    history.index -= 1;
    applyHistory(history.stack[history.index], '已撤销');
  }

  function redo() {
    if (history.suspended || !state.data || history.index < 0) return;
    const current = currentSnapshot();
    if (history.stack[history.index] !== current) {
      pushSnapshot(current);
      updateHistoryButtons();
      return;
    }
    if (history.index >= history.stack.length - 1) {
      updateHistoryButtons();
      return;
    }
    history.index += 1;
    applyHistory(history.stack[history.index], '已重做');
  }

  const $ = (selector) => document.querySelector(selector);
  const saveStateEl = () => document.getElementById('save-state');

  // ---------------- 本地服务检测 ----------------
  function showServiceBanner(title, detail) {
    const banner = document.getElementById('service-banner');
    if (!banner) return;
    document.getElementById('service-title').textContent = title;
    document.getElementById('service-detail').textContent = detail;
    banner.hidden = false;
  }

  function hideServiceBanner() {
    const banner = document.getElementById('service-banner');
    if (banner) banner.hidden = true;
  }

  async function checkService() {
    if (location.protocol === 'file:') {
      serviceConnected = false;
      showServiceBanner(
        '这个页面是直接打开的文件',
        'AI 和 data/resume.json 文件备份需要本地服务。请关掉它，双击文件夹里的 启动.command（Windows 用 启动.bat），用自动打开的 http://127.0.0.1:7788 页面；当前编辑仍会暂存在浏览器里。',
      );
      return null;
    }
    try {
      const res = await fetch('/api/ai-status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      serviceConnected = true;
      hideServiceBanner();
      return data;
    } catch (err) {
      serviceConnected = false;
      const reason = err?.message || 'Load failed';
      showServiceBanner(
        '本地服务未连接',
        `连不上 ${location.origin}（${reason}）。可能终端窗口被关掉了：重新双击启动脚本，再点「重新检测」。简历内容还在浏览器里，不会丢。`,
      );
      return null;
    }
  }

  // ---------------- 保存 ----------------
  function timeLabel() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function setSaveState(mode) {
    const el = saveStateEl();
    if (!el) return;
    el.classList.remove('is-saving', 'is-error', 'is-local');
    el.removeAttribute('title');
    state.saveMode = mode;
    if (mode === 'saving') {
      el.textContent = '保存中…';
      el.classList.add('is-saving');
    } else if (mode === 'local') {
      el.textContent = '已存浏览器 · 文件待保存';
      el.classList.add('is-local');
      el.title = '已写入浏览器缓存，但还没有写入本机 data/resume.json。点击可重试。';
    } else if (mode === 'saved') {
      el.textContent = `已保存到本机 · ${timeLabel()}`;
      el.title = '已写入浏览器缓存和本机 data/resume.json。';
      state.lastSaved = new Date();
    } else if (mode === 'fileError') {
      el.textContent = '浏览器已存 · 文件未保存';
      el.classList.add('is-error');
      el.title = '浏览器缓存已保存，但写本机文件失败。点击重试。';
    } else if (mode === 'offline') {
      el.textContent = '仅存浏览器';
      el.classList.add('is-local');
      el.title = '没有连接本地服务，简历只保存在浏览器缓存里。用启动脚本打开可写入文件。';
    } else if (mode === 'error') {
      el.textContent = '保存失败，点此重试';
      el.classList.add('is-error');
      el.title = '浏览器缓存写入失败。';
    } else {
      el.textContent = '已载入';
      el.title = '简历已载入，尚未修改。';
    }
  }

  function writeLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.data));
      state.save.local = true;
      if (state.save.server) setSaveState('saved');
      else setSaveState('local');
      return true;
    } catch (err) {
      state.save.local = false;
      setSaveState('error');
      toast('浏览器缓存满了（可能是图片太大），建议导出备份。', { error: true, duration: 5000 });
      return false;
    }
  }

  async function writeServer() {
    if (location.protocol === 'file:') {
      state.save.server = false;
      setSaveState('offline');
      return false;
    }
    try {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: state.data }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.save.server = true;
      setSaveState('saved');
      return true;
    } catch (err) {
      state.save.server = false;
      setSaveState('fileError');
      if (!state.save.warned) {
        state.save.warned = true;
        toast('浏览器里已保存；本机文件没有写入。点右上角保存状态可重试。', { error: true, duration: 5200 });
      }
      return false;
    }
  }

  const saveLocal = debounce(writeLocal, 320);
  const saveServer = debounce(writeServer, 1600);

  function scheduleSave(options = {}) {
    state.save.server = false;
    state.save.warned = false;
    setSaveState('saving');
    saveLocal();
    saveServer();
    if (options.history === false) clearTimeout(history.timer);
    else scheduleHistory();
    updateHistoryButtons();
  }
  state.scheduleSave = scheduleSave;

  function retrySave() {
    if (state.save.retrying) return;
    state.save.retrying = true;
    state.save.warned = false;
    setSaveState('saving');
    writeLocal();
    writeServer().finally(() => {
      state.save.retrying = false;
    });
  }
  state.retrySave = retrySave;

  async function loadData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return App.data.normalize(parsed);
      }
    } catch {
      /* 忽略坏缓存 */
    }
    try {
      const res = await fetch('/api/resume');
      const json = await res.json();
      if (json?.data) return App.data.normalize(json.data);
    } catch {
      /* 离线也能用默认样例 */
    }
    return App.data.normalize(U.deepClone(App.data.DEFAULT_DATA));
  }

  // ---------------- 缩放 ----------------
  function computeFit() {
    const stage = document.getElementById('stage-scroll');
    const page = document.getElementById('page');
    if (!stage || !page) return 1;
    const styles = getComputedStyle(stage);
    const padL = parseFloat(styles.paddingLeft) || 0;
    const padR = parseFloat(styles.paddingRight) || 0;
    const available = stage.clientWidth - padL - padR;
    return clamp(available / page.offsetWidth, 0.4, 1.05);
  }

  function updateScale() {
    const page = document.getElementById('page');
    const wrap = document.getElementById('page-scale');
    if (!page || !wrap) return;
    if (state.fitMode) state.zoom = computeFit();
    const zoom = state.zoom;
    page.style.transformOrigin = 'top left';
    page.style.transform = `scale(${zoom})`;
    wrap.style.width = `${Math.round(page.offsetWidth * zoom)}px`;
    wrap.style.height = `${Math.round(page.offsetHeight * zoom)}px`;
    const label = document.getElementById('zoom-label');
    if (label) label.textContent = `${Math.round(zoom * 100)}%`;
    const pageMm = page.offsetHeight / (96 / 25.4);
    const pageCount = Math.max(1, Math.ceil((pageMm - 1) / 297));
    state.pageCount = pageCount;
    const countLabel = document.getElementById('page-count');
    if (countLabel) countLabel.textContent = `约 ${pageCount} 页`;
    App.render.updateStickerBar();
  }

  function syncGuideBtn() {
    const btn = document.getElementById('toggle-guide');
    if (btn) btn.classList.toggle('is-on', Boolean(state.data?.view?.guide));
  }

  // ---------------- 面板 ----------------
  function drawerEl() {
    return document.getElementById('drawer');
  }

  function openPanel(tab) {
    const drawer = drawerEl();
    if (!drawer) return;
    App.currentPanel = tab;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('.workspace')?.classList.add('is-drawer-open');
    updateScale();
    document.querySelectorAll('.drawer-tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    document.querySelectorAll('[data-panel]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.panel === tab);
    });
    const body = document.getElementById('drawer-body');
    body.scrollTop = 0;
    const panel = App.panels?.[tab];
    if (panel) panel.render(body);
    if (tab === 'ai' || tab === 'settings') checkService();
  }

  function closePanel() {
    const drawer = drawerEl();
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.querySelector('.workspace')?.classList.remove('is-drawer-open');
    App.currentPanel = null;
    updateScale();
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.remove('is-active'));
  }

  function togglePanel(tab) {
    const drawer = drawerEl();
    if (drawer?.classList.contains('is-open') && App.currentPanel === tab) closePanel();
    else openPanel(tab);
  }

  function refreshPanel() {
    if (!App.currentPanel) return;
    const body = document.getElementById('drawer-body');
    if (!body) return;
    const top = body.scrollTop;
    App.panels[App.currentPanel]?.render(body);
    body.scrollTop = top;
  }

  function refreshPanelIf(tab) {
    if (App.currentPanel === tab && drawerEl()?.classList.contains('is-open')) refreshPanel();
  }

  // ---------------- 主题 / 数据刷新 ----------------
  function applyTheme(patch) {
    Object.assign(state.data.theme, patch);
    if (patch.font && state.data.theme.type) {
      const font = patch.font === 'serif' ? 'serif' : 'sans';
      for (const key of ['info', 'body', 'heading']) {
        state.data.theme.type[key].font = font;
      }
    }
    App.render.page();
    App.render.outline();
    scheduleSave();
  }

  function refreshData() {
    App.render.page();
    App.render.outline();
    scheduleSave();
  }

  // ---------------- 导入导出 ----------------
  function exportJson() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `简历备份-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    U.download(name, JSON.stringify(state.data, null, 2));
    toast('备份已下载');
  }

  // ---------------- 添加板块 ----------------
  function closeAddMenu() {
    const menu = document.getElementById('add-menu');
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }

  function onDocumentPointerDown(e) {
    const menu = document.getElementById('add-menu');
    if (!menu || menu.hidden) return;
    if (menu.contains(e.target)) return;
    if (e.target.closest('#btn-add-section, #btn-add-section-2')) return;
    closeAddMenu();
  }

  function openAddMenu(anchor) {
    const menu = document.getElementById('add-menu');
    if (!menu) return;
    menu.hidden = false;
    menu.innerHTML = '';
    for (const t of App.data.TEMPLATES) {
      const btn = h('button', { class: 'add-menu-item', type: 'button' });
      btn.append(
        h('span', { class: 'add-menu-icon', html: icon(t.icon, 14) }),
        h('span', { class: 'add-menu-text' }, h('strong', { text: t.title }), h('span', { text: t.desc })),
      );
      btn.addEventListener('click', () => addSection(t));
      menu.append(btn);
    }
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const rect = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + mw > window.innerWidth - 12) left = window.innerWidth - mw - 12;
    if (top + mh > window.innerHeight - 12) top = Math.max(12, rect.top - mh - 6);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = '';
    setTimeout(() => document.addEventListener('pointerdown', onDocumentPointerDown, true), 0);
  }

  function addSection(template) {
    const sec = App.data.section({
      kind: template.kind,
      title: template.title,
      icon: template.icon,
      items: [template.sample()],
    });
    state.data.sections.push(sec);
    state.activeSection = sec.id;
    App.render.page();
    App.render.outline();
    scheduleSave();
    closeAddMenu();
    toast(`已添加「${template.title}」`);
    App.render.focusSelector(`.cv-sec[data-sid="${sec.id}"] .cv-sec-title`);
  }

  // ---------------- 事件绑定 ----------------
  function bindEvents() {
    document.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => togglePanel(btn.dataset.panel));
    });
    document.querySelectorAll('.drawer-tab').forEach((tab) => {
      tab.addEventListener('click', () => openPanel(tab.dataset.tab));
    });
    document.getElementById('drawer-close')?.addEventListener('click', closePanel);

    document.getElementById('service-retry')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '检测中…';
      const status = await checkService();
      if (status) App.aiStatus = status;
      btn.disabled = false;
      btn.textContent = '重新检测';
    });

    saveStateEl()?.addEventListener('click', retrySave);
    document.getElementById('undo-btn')?.addEventListener('click', undo);
    document.getElementById('redo-btn')?.addEventListener('click', redo);
    document.getElementById('btn-backup')?.addEventListener('click', exportJson);
    document.getElementById('btn-print')?.addEventListener('click', () => {
      App.render.selectSticker(null);
      updateScale();
      toast(
        `当前约 ${state.pageCount || 1} 页。打印窗口里选「另存为 PDF」、边距「无」、勾选「背景图形」。`,
        { duration: 5600 },
      );
      setTimeout(() => window.print(), 700);
    });

    const addBtn = document.getElementById('btn-add-section');
    const addBtn2 = document.getElementById('btn-add-section-2');
    [addBtn, addBtn2].forEach((btn) => {
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('add-menu');
        if (menu && !menu.hidden) closeAddMenu();
        else openAddMenu(btn);
      });
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
      state.fitMode = false;
      state.zoom = clamp(state.zoom - 0.1, 0.4, 1.5);
      updateScale();
    });
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      state.fitMode = false;
      state.zoom = clamp(state.zoom + 0.1, 0.4, 1.5);
      updateScale();
    });
    document.getElementById('zoom-label')?.addEventListener('click', () => {
      state.fitMode = false;
      state.zoom = 1;
      updateScale();
    });
    document.getElementById('zoom-fit')?.addEventListener('click', () => {
      state.fitMode = true;
      updateScale();
    });
    document.getElementById('toggle-guide')?.addEventListener('click', () => {
      state.data.view.guide = !state.data.view.guide;
      App.render.page();
      syncGuideBtn();
      scheduleSave();
    });

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.sticker') && !e.target.closest('.sticker-bar')) {
        if (state.selectedSticker) App.render.selectSticker(null);
      }
    });

    document.getElementById('stage-scroll')?.addEventListener(
      'scroll',
      () => {
        requestAnimationFrame(() => App.render.updateStickerBar());
      },
      { passive: true },
    );

    window.addEventListener('resize', () => updateScale());
    window.addEventListener('beforeprint', () => App.render.selectSticker(null));
    window.addEventListener('beforeunload', () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state.data));
      } catch {
        /* 忽略 */
      }
    });

    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        const active = document.activeElement;
        const editing =
          active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
        if (!editing) {
          e.preventDefault();
          if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
          else undo();
          return;
        }
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        exportJson();
        return;
      }
      if (e.key === 'Escape') {
        const menu = document.getElementById('add-menu');
        if (menu && !menu.hidden) {
          closeAddMenu();
          return;
        }
        if (drawerEl()?.classList.contains('is-open')) {
          closePanel();
          return;
        }
        if (state.selectedSticker) App.render.selectSticker(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedSticker) {
        const active = document.activeElement;
        if (active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))) return;
        e.preventDefault();
        App.render.removeSticker(state.selectedSticker);
        refreshPanelIf('sticker');
      }
    });

    const page = document.getElementById('page');
    if (page && typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        if (state.__raf) return;
        state.__raf = true;
        requestAnimationFrame(() => {
          state.__raf = false;
          updateScale();
        });
      }).observe(page);
    }
  }

  // ---------------- 对外 UI API ----------------
  App.ui = {
    openPanel,
    closePanel,
    togglePanel,
    refreshPanel,
    refreshPanelIf,
    applyTheme,
    refreshData,
    updateScale,
    syncOutlineActive() {
      document.querySelectorAll('.outline-row').forEach((row) => {
        row.classList.toggle('is-active', row.dataset.sid === state.activeSection);
      });
    },
    exportJson,
    addSection,
    checkService,
    undo,
    redo,
  };

  // ---------------- 启动 ----------------
  async function boot() {
    state.data = await loadData();
    bindEvents();
    App.render.page();
    App.render.outline();
    syncGuideBtn();
    updateScale();
    resetHistory();
    setSaveState('idle');
    if (document.fonts?.ready) document.fonts.ready.then(() => updateScale());
    setTimeout(() => updateScale(), 120);

    checkService().then((status) => {
      if (status) App.aiStatus = status;
    });

    const rawLocal = localStorage.getItem(KEY);
    if (!rawLocal) {
      const hasServer = await fetch('/api/resume')
        .then((r) => r.json())
        .then((j) => Boolean(j?.data))
        .catch(() => false);
      if (!hasServer) toast('已载入示例简历，直接改就行', { duration: 3200 });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
