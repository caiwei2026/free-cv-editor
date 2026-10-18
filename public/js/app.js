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
  });

  let serviceConnected = null;

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
  function setSaveState(mode) {
    const el = saveStateEl();
    if (!el) return;
    el.classList.remove('is-saving', 'is-error');
    if (mode === 'saving') {
      el.textContent = '保存中…';
      el.classList.add('is-saving');
    } else if (mode === 'error') {
      el.textContent = '保存失败';
      el.classList.add('is-error');
    } else {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      el.textContent = `已保存 · ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      state.lastSaved = now;
    }
  }

  function writeLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.data));
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      toast('浏览器缓存满了（可能是图片太大），建议导出备份；服务端文件仍在保存。', { error: true, duration: 5000 });
    }
  }

  async function writeServer() {
    try {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: state.data }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      /* 本地缓存已保存，服务端失败不阻塞编辑 */
    }
  }

  const saveLocal = debounce(writeLocal, 320);
  const saveServer = debounce(writeServer, 1600);

  function scheduleSave() {
    setSaveState('saving');
    saveLocal();
    saveServer();
  }
  state.scheduleSave = scheduleSave;

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

    document.getElementById('btn-backup')?.addEventListener('click', exportJson);
    document.getElementById('btn-print')?.addEventListener('click', () => {
      App.render.selectSticker(null);
      toast('打印窗口里勾选「背景图形」、边距选「无」，底色和贴图才会保留', { duration: 5200 });
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
  };

  // ---------------- 启动 ----------------
  async function boot() {
    state.data = await loadData();
    bindEvents();
    App.render.page();
    App.render.outline();
    syncGuideBtn();
    updateScale();
    setSaveState('saved');
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
