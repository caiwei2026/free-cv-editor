/* AI 面板：生成背景风格、生成贴图、润色文字（走本机 DSH 登录的 DeepSeek） */
(function () {
  const App = window.App;
  const U = App.util;
  const { h, icon, toast } = U;

  const SYSTEM_STYLE = `你是资深简历视觉设计师，帮用户设计中文简历（A4 白纸）的浅色背景风格。
只输出一个 JSON 对象，不要解释、不要 markdown 代码块、不要任何多余文字。字段如下：
{
  "name": "风格名，中文，不超过 8 个字",
  "description": "一句话说明，中文，不超过 30 个字",
  "accent": "主色，#RRGGBB，用于板块标题与强调，在浅色纸上清晰可读",
  "font": "sans 或 serif",
  "heading": "plain 或 underline 或 bar 或 block",
  "background": "一段合法的 CSS background 简写值，铺在 A4 白纸上"
}
规则：
- 背景整体必须很浅（大面积明度 ≥ 92%），不能干扰黑色正文阅读
- 只用纯色或渐变：linear-gradient / radial-gradient / repeating-linear-gradient
- 禁止 url(...)、@import、position、filter、mix-blend-mode、animation、图片、超大深色块
- 渐变尺寸用 mm 或 %，例如：linear-gradient(180deg, #f4f8ff 0, #ffffff 120mm)
- accent 与背景协调，避免荧光色
- heading 与气质一致：现代简洁用 underline 或 plain；稳重专业用 bar；活泼一点用 block
示例：{"name":"晨雾蓝","description":"自上而下淡蓝过渡到白，干净克制","accent":"#1d4ed8","font":"sans","heading":"underline","background":"linear-gradient(180deg, #f1f6ff 0, #ffffff 110mm)"}`;

  const SYSTEM_STICKER = `你是 SVG 装饰图案设计师，为中文简历设计小的装饰贴图。
只输出一个完整的 SVG 代码，不要 markdown 代码块，不要任何解释。
硬性要求：
- 根元素写成 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
- 图案居中，四周留 8 左右边距，视觉重心在画面中心
- 配色克制，最多 3 种颜色；单色时可用 fill="currentColor"
- 不要文字、不要外部图片、不要 <script>、<foreignObject>、<style>、动画、滤镜
- 线条粗细 3–6，端点用 stroke-linecap="round"
- 背景透明，适合摆在简历的空白角落做点缀`;

  const SYSTEM_POLISH = `你是中文简历写作专家。按要求改写用户给出的简历文字。
- 保持事实不变：不编造经历、公司、学校、数字或奖项
- 只输出改写后的文字，不要解释、不要引号、不要 markdown、不要序号
- 语言简洁、动词开头、结果导向；保持原文句数量级，不要扩写成一大段
- 保留中文与英文/数字之间的空格习惯，不要挤在一起
- 不要输出「改写后：」这类前缀`;

  const STYLE_EXAMPLES = [
    '米白纸张 + 细网点，安静学术风',
    '深海蓝渐变，商务稳重',
    '浅绿角落色块，清爽有活力',
    '莫兰迪灰紫，柔和高级',
    '报纸感米白 + 细网格线',
  ];

  const STICKER_EXAMPLES = ['四角星闪光', '一片小叶子', '手绘小箭头', '极简圆形印章', '波浪线条装饰'];

  const POLISH_PRESETS = [
    { id: 'professional', label: '更专业', instruction: '用更专业的书面表达，突出职责层级和技术深度' },
    { id: 'concise', label: '更精简', instruction: '压缩到原长度的 60% 左右，去掉冗余修饰，保留关键结果' },
    { id: 'metric', label: '更量化', instruction: '突出可量化的结果和影响；原文没有数字时不要虚构，改为强调结果与影响' },
  ];

  const aiState = {
    style: { loading: false, error: '', result: null, prompt: '' },
    sticker: { loading: false, error: '', result: null, prompt: '' },
    polish: { loading: false, error: '', result: null, original: '', instruction: '', target: null },
  };

  async function ask({ system, user, maxTokens = 1600, temperature = 0.8 }) {
    let res;
    try {
      res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system, messages: [{ role: 'user', content: user }], maxTokens, temperature }),
      });
    } catch (err) {
      App.ui?.checkService?.();
      throw new Error(
        `连不上本地服务（${err.message || 'Load failed'}）。请用启动脚本打开的页面再试，或点上方提示里的「重新检测」。`,
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `请求失败（HTTP ${res.status}）`);
      err.code = data.code || '';
      throw err;
    }
    return String(data.text || '').trim();
  }

  function sync(host, painter) {
    if (host && host.isConnected) painter(host);
    else App.ui?.refreshPanelIf?.('ai');
  }

  function parseJsonLoose(text) {
    let cleaned = String(text || '')
      .replace(/^```[a-zA-Z]*\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  function validateTheme(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('AI 返回的内容没解析成 JSON，再试一次或换个说法。');
    const accent = String(raw.accent || '').trim();
    const background = String(raw.background || '').trim();
    let font = String(raw.font || '').trim();
    let heading = String(raw.heading || '').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
      throw new Error('AI 给的主色不是合法的 #RRGGBB，再生成一次试试。');
    }
    if (!background || background.length > 400 || /url\s*\(|@import|<|javascript:|expression/i.test(background)) {
      throw new Error('AI 给的背景样式不安全或为空，再生成一次试试。');
    }
    if (!['sans', 'serif'].includes(font)) font = 'sans';
    if (!['plain', 'underline', 'bar', 'block'].includes(heading)) heading = 'underline';
    return {
      name: String(raw.name || 'AI 风格').slice(0, 12),
      description: String(raw.description || '').slice(0, 60),
      accent,
      font,
      heading,
      background,
    };
  }

  // ---------------- 生成：背景风格 ----------------
  function generateStyle(host, prompt) {
    if (!prompt.trim()) {
      toast('先描述一下你想要的感觉', { error: true });
      return;
    }
    aiState.style = { loading: true, error: '', result: null, prompt };
    paintStyleResult(host);

    ask({
      system: SYSTEM_STYLE,
      user: `用户想要的风格：${prompt.trim()}\n\n请按要求只返回 JSON。`,
      maxTokens: 900,
      temperature: 0.95,
    })
      .then((text) => {
        const parsed = parseJsonLoose(text);
        const theme = validateTheme(parsed);
        aiState.style = { loading: false, error: '', result: theme, prompt };
        sync(host, paintStyleResult);
      })
      .catch((err) => {
        aiState.style = { loading: false, error: err.message, result: null, prompt };
        sync(host, paintStyleResult);
      });
  }

  function paintStyleResult(host) {
    host.innerHTML = '';
    const state = aiState.style;
    if (state.loading) {
      host.append(loadingRow('正在设计背景…'));
      return;
    }
    if (state.error) {
      host.append(errorBox(state.error, () => generateStyle(host, state.prompt || '')));
      return;
    }
    if (!state.result) return;

    const r = state.result;
    const preview = h('div', { class: 'ai-theme-preview' });
    preview.style.background = r.background;
    preview.append(
      h('div', { class: 'ai-theme-preview-inner' },
        h('div', { class: 'atp-name', text: '王小二', style: `color:${r.accent}` }),
        h('div', { class: 'atp-line atp-strong', style: `background:${r.accent}` }),
        h('div', { class: 'atp-line' }),
        h('div', { class: 'atp-line short' }),
      ),
    );

    const card = h('div', { class: 'ai-result' });
    const head = h('div', { class: 'ai-result-head' });
    head.innerHTML = `${icon('palette', 14)}<span>${escape(r.name)}</span>`;
    card.append(head, h('p', { class: 'ai-result-desc', text: r.description || 'AI 为你设计的背景风格' }), preview);

    const info = h('div', { class: 'ai-tags' });
    info.append(swatchChip(r.accent), chip(r.font === 'serif' ? '衬线字体' : '无衬线字体'));
    const headingName = { plain: '无装饰标题', underline: '下划线标题', bar: '竖线标题', block: '色块标题' }[r.heading];
    info.append(chip(headingName));
    card.append(info);

    const actions = h('div', { class: 'btn-row', style: 'margin-top:10px' });
    const applyBtn = h('button', { class: 'btn accent', type: 'button' }, '应用到简历');
    applyBtn.addEventListener('click', () => {
      App.ui.applyTheme({
        accent: r.accent,
        font: r.font,
        heading: r.heading,
        background: r.background,
        presetId: 'ai',
      });
      toast(`已应用风格「${r.name}」`);
    });
    const retry = h('button', { class: 'btn', type: 'button' }, '再生成一个');
    retry.addEventListener('click', () => {
      const el = document.getElementById('ai-style-prompt');
      generateStyle(host, (el && el.value) || state.prompt || '');
    });
    actions.append(applyBtn, retry);
    card.append(actions);
    host.append(card);
  }

  // ---------------- 生成：贴图 ----------------
  function generateSticker(host, prompt) {
    if (!prompt.trim()) {
      toast('先说一下想要什么图案', { error: true });
      return;
    }
    aiState.sticker = { loading: true, error: '', result: null, prompt };
    paintStickerResult(host);

    ask({
      system: SYSTEM_STICKER,
      user: `想要的贴图：${prompt.trim()}\n\n请只输出 SVG 代码。`,
      maxTokens: 1600,
      temperature: 0.85,
    })
      .then((text) => {
        const svg = U.sanitizeSvg(text);
        if (!svg) throw new Error('AI 这次没给出可用的 SVG，再生成一次试试。');
        aiState.sticker = { loading: false, error: '', result: { svg, prompt }, prompt };
        sync(host, paintStickerResult);
      })
      .catch((err) => {
        aiState.sticker = { loading: false, error: err.message, result: null, prompt };
        sync(host, paintStickerResult);
      });
  }

  function paintStickerResult(host) {
    host.innerHTML = '';
    const state = aiState.sticker;
    if (state.loading) {
      host.append(loadingRow('正在画贴图…'));
      return;
    }
    if (state.error) {
      host.append(errorBox(state.error, () => generateSticker(host, state.prompt || '')));
      return;
    }
    if (!state.result) return;

    const { svg } = state.result;
    const card = h('div', { class: 'ai-result' });
    const head = h('div', { class: 'ai-result-head' });
    head.innerHTML = `${icon('image', 14)}<span>贴图预览</span>`;
    const stage = h('div', { class: 'ai-svg-preview' });
    stage.innerHTML = svg;
    stage.style.color = App.state.data.theme.accent;
    card.append(head, stage);

    const actions = h('div', { class: 'btn-row' });
    const addBtn = h('button', { class: 'btn accent', type: 'button' }, '加到简历上');
    addBtn.addEventListener('click', () => {
      const st = App.render.addSticker({ svg, name: 'AI 贴图', tintable: false });
      App.render.selectSticker(st.id);
      toast('贴图已加到纸上，拖动可以挪位置');
    });
    const regen = h('button', { class: 'btn', type: 'button' }, '换一个');
    regen.addEventListener('click', () => {
      const el = document.getElementById('ai-sticker-prompt');
      generateSticker(host, (el && el.value) || state.prompt || '');
    });
    actions.append(addBtn, regen);
    card.append(actions);
    host.append(card);
  }

  // ---------------- 润色文字 ----------------
  function currentTarget() {
    const f = App.focus;
    if (!f.node || !f.obj || !f.field) return null;
    const text = String(f.obj[f.field] || '').trim();
    if (!text) return null;
    const target = { obj: f.obj, field: f.field, node: f.node, text };
    if (f.obj.__itemId != null && f.obj.__idx != null) {
      target.bullet = { itemId: f.obj.__itemId, idx: f.obj.__idx };
    }
    return target;
  }

  function findResumeObj(id) {
    for (const sec of App.state.data.sections) {
      if (sec.id === id) return sec;
      const item = sec.items.find((it) => it.id === id);
      if (item) return item;
    }
    return null;
  }

  function resolvePolishTarget(target) {
    if (!target) return null;
    if (target.bullet) {
      const item = findResumeObj(target.bullet.itemId);
      if (!item || !Array.isArray(item.bullets) || target.bullet.idx < 0) return null;
      if (target.bullet.idx >= item.bullets.length) return null;
      if (String(item.bullets[target.bullet.idx] || '').trim() !== target.text) return null;
      return { item, idx: target.bullet.idx, node: target.node };
    }
    let obj = target.obj;
    if (obj && obj.id) {
      const found = findResumeObj(obj.id);
      if (found) obj = found;
      else if (!target.node || !target.node.isConnected) return null;
    }
    if (!obj) return null;
    if (String(obj[target.field] || '').trim() !== target.text) return null;
    return { obj, field: target.field, node: target.node };
  }

  function polish(host, instruction, label) {
    const target = currentTarget();
    if (!target) {
      toast('先在简历上点一下要修改的那段文字', { error: true });
      return;
    }
    aiState.polish = { loading: true, error: '', result: null, original: target.text, instruction, label, target };
    paintPolishResult(host);

    ask({
      system: SYSTEM_POLISH,
      user: `原文：\n"""${target.text}"""\n\n改写要求：${instruction}`,
      maxTokens: 1200,
      temperature: 0.55,
    })
      .then((text) => {
        aiState.polish = {
          loading: false,
          error: '',
          result: text,
          original: target.text,
          instruction,
          label,
          target,
        };
        sync(host, paintPolishResult);
      })
      .catch((err) => {
        aiState.polish = { loading: false, error: err.message, result: null, original: target.text, instruction, target };
        sync(host, paintPolishResult);
      });
  }

  function paintPolishResult(host) {
    host.innerHTML = '';
    const state = aiState.polish;
    if (state.loading) {
      host.append(loadingRow('正在改写…'));
      return;
    }
    if (state.error) {
      host.append(errorBox(state.error, () => polish(host, state.instruction, state.label)));
      return;
    }
    if (!state.result) return;

    const card = h('div', { class: 'ai-result' });
    const head = h('div', { class: 'ai-result-head' });
    head.innerHTML = `${icon('wand', 14)}<span>改写结果</span>`;
    const box = h('div', { class: 'polish-text', text: state.result });
    const compare = h('div', { class: 'polish-compare' });
    const origCol = h('div', { class: 'polish-col' });
    origCol.append(
      h('span', { class: 'polish-label', text: '原文' }),
      h('div', { class: 'polish-original', text: state.original }),
    );
    const newCol = h('div', { class: 'polish-col' });
    newCol.append(h('span', { class: 'polish-label', text: '改写后' }), box);
    compare.append(origCol, newCol);
    const actions = h('div', { class: 'btn-row', style: 'margin-top:10px' });
    const applyBtn = h('button', { class: 'btn accent', type: 'button', title: '只替换生成时选中的那段文字' }, '替换原文');
    applyBtn.addEventListener('click', () => {
      const live = resolvePolishTarget(state.target);
      if (!live) {
        toast('生成时选中的原文已经变化或被删除，请重新生成', { error: true });
        return;
      }
      if (live.item) live.item.bullets[live.idx] = state.result;
      else live.obj[live.field] = state.result;
      if (live.node?.isConnected) live.node.textContent = state.result;
      else App.render.page();
      App.state.scheduleSave();
      toast('已替换，可用顶部撤销恢复');
      aiState.polish.result = null;
      paintPolishResult(host);
    });
    const copyBtn = h('button', { class: 'btn', type: 'button' }, '复制');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(state.result);
        toast('已复制');
      } catch {
        toast('复制失败，手动选中吧', { error: true });
      }
    });
    const discard = h('button', { class: 'btn', type: 'button' }, '丢弃');
    discard.addEventListener('click', () => {
      aiState.polish.result = null;
      paintPolishResult(host);
    });
    actions.append(applyBtn, copyBtn, discard);
    card.append(head, compare, actions);
    host.append(card);
  }

  // ---------------- 面板 UI ----------------
  function render(container) {
    container.innerHTML = '';

    const intro = h('div', { class: 'ai-intro' });
    intro.innerHTML = `${icon('sparkle', 15)}<div><strong>AI 助手</strong><span>先润色经历，再考虑背景和贴图。生成结果先预览，确认后才写入。</span></div>`;
    container.append(intro);

    // 背景风格
    const styleBlock = h('div', { class: 'drawer-section' });
    styleBlock.append(sectionHead('生成背景风格', '描述你想要的感觉'));
    const stylePrompt = h('textarea', {
      class: 'textarea',
      id: 'ai-style-prompt',
      placeholder: '例如：想要安静克制的学术风，米白纸感，右上角一点淡淡的绿色光晕',
      rows: '3',
    });
    stylePrompt.value = aiState.style.prompt || '';
    const styleChips = h('div', { class: 'chips' });
    for (const example of STYLE_EXAMPLES) {
      const chipEl = h('button', { class: 'chip', type: 'button', text: example });
      chipEl.addEventListener('click', () => {
        stylePrompt.value = example;
        stylePrompt.focus();
      });
      styleChips.append(chipEl);
    }
    const styleResult = h('div', { class: 'ai-result-host' });
    const styleBtn = h('button', { class: 'btn primary block', type: 'button', style: 'margin-top:10px' });
    styleBtn.innerHTML = `${icon('sparkle', 14)}<span>生成风格</span>`;
    styleBtn.addEventListener('click', () => generateStyle(styleResult, stylePrompt.value));
    styleBlock.append(stylePrompt, styleChips, styleBtn, styleResult);
    paintStyleResult(styleResult);
    container.append(styleBlock);

    // 贴图
    const stickerBlock = h('div', { class: 'drawer-section' });
    stickerBlock.append(sectionHead('生成小贴图', '描述图案，AI 给你一张 SVG'));
    const stickerPrompt = h('textarea', {
      class: 'textarea',
      id: 'ai-sticker-prompt',
      placeholder: '例如：极简线条的一片小叶子，深绿色，适合放在角落',
      rows: '2',
      style: 'min-height:60px',
    });
    stickerPrompt.value = aiState.sticker.prompt || '';
    const stickerChips = h('div', { class: 'chips' });
    for (const example of STICKER_EXAMPLES) {
      const chipEl = h('button', { class: 'chip', type: 'button', text: example });
      chipEl.addEventListener('click', () => {
        stickerPrompt.value = example;
        stickerPrompt.focus();
      });
      stickerChips.append(chipEl);
    }
    const stickerResult = h('div', { class: 'ai-result-host' });
    const stickerBtn = h('button', { class: 'btn primary block', type: 'button', style: 'margin-top:10px' });
    stickerBtn.innerHTML = `${icon('image', 14)}<span>生成贴图</span>`;
    stickerBtn.addEventListener('click', () => generateSticker(stickerResult, stickerPrompt.value));
    stickerBlock.append(stickerPrompt, stickerChips, stickerBtn, stickerResult);
    paintStickerResult(stickerResult);
    container.append(stickerBlock);

    // 润色
    const polishBlock = h('div', { class: 'drawer-section' });
    polishBlock.append(sectionHead('润色文字', '在纸上点一段文字，再选改写方式'));
    const target = currentTarget();
    const targetBox = h('div', { class: 'polish-target' });
    if (target) {
      targetBox.append(h('span', { class: 'polish-target-label', text: '当前文字' }), h('p', { text: target.text }));
    } else {
      targetBox.append(h('p', { class: 'muted', text: '还没有选中文字。先在简历上点一下要改的那一句，再回来。' }));
    }
    const presetRow = h('div', { class: 'chips' });
    for (const preset of POLISH_PRESETS) {
      const btn = h('button', { class: 'chip', type: 'button', text: preset.label });
      btn.addEventListener('click', () => polish(polishResult, preset.instruction, preset.label));
      presetRow.append(btn);
    }
    const customRow = h('div', { class: 'row', style: 'margin-top:8px;gap:6px' });
    const customInput = h('input', { class: 'input', placeholder: '自定义要求，比如「更像应届生」' });
    const customBtn = h('button', { class: 'btn', type: 'button' }, '改写');
    customBtn.addEventListener('click', () => {
      const v = customInput.value.trim();
      if (!v) {
        toast('先写一句改写要求', { error: true });
        return;
      }
      polish(polishResult, v, '自定义');
    });
    customRow.append(customInput, customBtn);
    const polishResult = h('div', { class: 'ai-result-host', style: 'margin-top:10px' });
    polishBlock.append(targetBox, presetRow, customRow, polishResult);
    paintPolishResult(polishResult);
    container.append(polishBlock);
    container.insertBefore(polishBlock, styleBlock);

    const foot = h('p', { class: 'ai-foot' });
    foot.innerHTML = `生成的内容会先给你预览，点「应用 / 替换」才写进简历。AI 输出可能不稳，不满意就再生成一次。`;
    container.append(foot);
  }

  function sectionHead(title, sub) {
    const row = h('div', { class: 'section-title' });
    row.append(h('h3', { text: title }));
    if (sub) row.append(h('span', { class: 'sub', text: sub }));
    return row;
  }

  function loadingRow(text) {
    const row = h('div', { class: 'ai-loading' });
    row.append(h('span', { class: 'spinner' }), h('span', { text }));
    return row;
  }

  function errorBox(message, onRetry) {
    const box = h('div');
    box.append(h('div', { class: 'ai-error', text: message }));
    const row = h('div', { class: 'btn-row', style: 'margin-top:8px' });
    const retry = h('button', { class: 'btn', type: 'button' }, '重试');
    retry.addEventListener('click', onRetry);
    const settings = h('button', { class: 'btn', type: 'button' }, '查看 AI 设置');
    settings.addEventListener('click', () => App.ui.openPanel('settings'));
    row.append(retry, settings);
    box.append(row);
    return box;
  }

  function chip(text) {
    return h('span', { class: 'ai-tag', text });
  }

  function swatchChip(color) {
    const wrap = h('span', { class: 'ai-tag ai-tag-color' });
    const dot = h('i');
    dot.style.background = color;
    wrap.append(dot, h('span', { text: color.toUpperCase() }));
    return wrap;
  }

  function escape(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  App.ai = { ask, state: aiState };
  App.panels = App.panels || {};
  App.panels.ai = { render };
})();
