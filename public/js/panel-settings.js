/* 设置面板：AI 状态、数据备份、快捷键 */
(function () {
  const App = window.App;
  const U = App.util;
  const { h, icon, toast } = U;

  function render(container) {
    container.innerHTML = '';

    // ---- AI 状态 ----
    const aiBlock = h('div', { class: 'drawer-section' });
    aiBlock.append(sectionHead('AI 连接', '本机 DeepSeek'));
    const statusCard = h('div', { class: 'status-card' });
    statusCard.innerHTML = `<div class="status-line"><span class="status-dot is-pending"></span><span>正在检测…</span></div>`;
    aiBlock.append(statusCard);
    const note = h('p', { class: 'muted', style: 'margin-top:10px' });
    note.innerHTML =
      'AI 功能直接复用本机 DeepSeek Harness 的登录态（读取 <code>~/.dsh/.credentials.yaml</code>），调用 <code>deepseek-flash</code>，不需要填 API Key。如果提示登录失效，打开 DeepSeek Harness 重新登录即可。';
    aiBlock.append(note);
    container.append(aiBlock);
    checkStatus(statusCard);

    // ---- 数据 ----
    const dataBlock = h('div', { class: 'drawer-section' });
    dataBlock.append(sectionHead('数据', '自动保存'));

    const exportBtn = h('button', { class: 'btn', type: 'button' });
    exportBtn.innerHTML = `${icon('download', 13)}<span>导出 JSON 备份</span>`;
    exportBtn.addEventListener('click', () => App.ui.exportJson());

    const importBtn = h('button', { class: 'btn', type: 'button' });
    importBtn.innerHTML = `${icon('upload', 13)}<span>导入备份</span>`;
    const importInput = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const data = App.data.normalize(parsed);
        if (!Array.isArray(data.sections) || !data.meta) throw new Error('这个文件不像是简历备份');
        App.state.data = data;
        App.state.activeSection = null;
        App.state.selectedSticker = null;
        App.render.page();
        App.render.outline();
        App.state.scheduleSave();
        App.ui.refreshPanel();
        toast('备份已导入');
      } catch (err) {
        toast(err.message || '导入失败，检查一下文件', { error: true });
      }
    });

    const reloadBtn = h('button', { class: 'btn', type: 'button' }, '从本机文件重新载入');
    reloadBtn.addEventListener('click', () => App.ui.reloadFromFile());

    const resetBtn = h('button', { class: 'btn', type: 'button', style: 'color:#b23c2e' }, '恢复示例简历');
    resetBtn.addEventListener('click', () => {
      if (!window.confirm('会清空当前内容，恢复成示例简历。建议先导出备份，确定吗？')) return;
      App.state.data = App.data.normalize(U.deepClone(App.data.DEFAULT_DATA));
      App.state.activeSection = null;
      App.state.selectedSticker = null;
      App.render.page();
      App.render.outline();
      App.state.scheduleSave();
      App.ui.refreshPanel();
      toast('已恢复示例简历');
    });

    const row1 = h('div', { class: 'btn-row' });
    row1.append(exportBtn, importBtn);
    const row2 = h('div', { class: 'btn-row', style: 'margin-top:8px' });
    row2.append(reloadBtn, resetBtn);
    dataBlock.append(
      row1,
      importInput,
      row2,
      h('p', { class: 'muted', style: 'margin:6px 0 0' }, '「从本机文件重新载入」会读取 data/resume.json，覆盖页面上的浏览器缓存版本。'),
    );

    const pathNote = h('div', { class: 'path-note' });
    pathNote.innerHTML = `<strong>保存位置</strong><span>${escapeHtml(App.dataPath || 'data/resume.json')}</span><span>以及浏览器 localStorage（双保险）</span>`;
    dataBlock.append(pathNote);
    container.append(dataBlock);

    // ---- 快捷键 ----
    const keyBlock = h('div', { class: 'drawer-section' });
    keyBlock.append(sectionHead('快捷键', ''));
    const keys = [
      ['⌘ / Ctrl + S', '导出 JSON 备份'],
      ['⌘ / Ctrl + P', '打印 / 导出 PDF'],
      ['Enter', '在描述里换行（新增一条）'],
      ['Esc', '关闭面板 / 取消选中贴图'],
      ['拖动板块行', '调整板块顺序'],
    ];
    const list = h('div', { class: 'shortcut-list' });
    for (const [key, desc] of keys) {
      const row = h('div', { class: 'shortcut-row' });
      row.append(h('kbd', { text: key }), h('span', { text: desc }));
      list.append(row);
    }
    keyBlock.append(list);
    container.append(keyBlock);

    // ---- 关于 ----
    const aboutBlock = h('div', { class: 'drawer-section' });
    aboutBlock.append(sectionHead('关于', ''));
    const about = h('p', { class: 'muted' });
    about.innerHTML =
      '简历工作台 · 本地版。页面和简历数据都放在这个文件夹里，不上传任何服务器；只有点 AI 生成时，提示词和选中的文字会发给 DeepSeek。';
    aboutBlock.append(about);
    container.append(aboutBlock);
  }

  function renderProblem(card, title, detail) {
    card.innerHTML = '';
    const line = h('div', { class: 'status-line' });
    const text = h('div', { class: 'status-text' });
    text.append(h('strong', { text: title }), h('span', { text: detail }));
    line.append(h('span', { class: 'status-dot is-bad' }), text);
    const row = h('div', { class: 'row', style: 'margin-top:10px;align-items:center' });
    const retry = h('button', { class: 'btn', type: 'button' }, '重新检测');
    retry.addEventListener('click', () => {
      App.ui.checkService();
      checkStatus(card);
    });
    row.append(retry);
    card.append(line, row);
  }

  async function checkStatus(card) {
    card.innerHTML = '<div class="status-line"><span class="status-dot is-pending"></span><span>正在检测…</span></div>';
    if (location.protocol === 'file:') {
      renderProblem(
        card,
        '页面是直接打开的文件',
        'AI 和文件备份需要本地服务。请关掉这个页面，双击文件夹里的 启动.command（Windows 用 启动.bat），用自动打开的 http://127.0.0.1:7788 页面。',
      );
      return;
    }
    try {
      const res = await fetch('/api/ai-status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      card.innerHTML = '';
      const line = h('div', { class: 'status-line' });
      const dot = h('span', { class: `status-dot ${data.ok ? 'is-ok' : 'is-bad'}` });
      const text = h('div', { class: 'status-text' });
      text.append(
        h('strong', { text: data.ok ? data.label || 'DeepSeek 已就绪' : '没有检测到登录态' }),
        h('span', { text: data.ok ? `模型 ${data.model}` : data.detail || '打开 DeepSeek Harness 登录后再试' }),
      );
      line.append(dot, text);
      card.append(line);
      if (data.ok) {
        const testBtn = h('button', { class: 'btn', type: 'button', style: 'margin-top:10px' }, '测试连接');
        const result = h('span', { class: 'muted', style: 'margin-left:8px' });
        testBtn.addEventListener('click', async () => {
          testBtn.disabled = true;
          result.textContent = '测试中…';
          const started = performance.now();
          try {
            const r = await fetch('/api/ai', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                system: '你是联通性测试助手。',
                messages: [{ role: 'user', content: '只回复两个字：正常' }],
                maxTokens: 32,
                temperature: 0,
              }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || '调用失败');
            result.textContent = `正常 · ${((performance.now() - started) / 1000).toFixed(1)}s`;
          } catch (err) {
            result.textContent = err.message;
            result.style.color = '#b23c2e';
          } finally {
            testBtn.disabled = false;
          }
        });
        const row = h('div', { class: 'row', style: 'align-items:center' });
        row.append(testBtn, result);
        card.append(row);
      }
    } catch (err) {
      renderProblem(
        card,
        '连不上本地服务',
        `服务可能没启动，或终端窗口被关掉了（${err.message || 'Load failed'}）。重新双击启动脚本，再点「重新检测」。简历内容还存在浏览器里。`,
      );
    }
  }

  function sectionHead(title, sub) {
    const row = h('div', { class: 'section-title' });
    row.append(h('h3', { text: title }));
    if (sub) row.append(h('span', { class: 'sub', text: sub }));
    return row;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  App.panels = App.panels || {};
  App.panels.settings = { render };
})();
