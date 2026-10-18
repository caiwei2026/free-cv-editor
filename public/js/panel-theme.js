/* 主题面板：背景预设、主色、字体、标题样式、头像 */
(function () {
  const App = window.App;
  const U = App.util;
  const { h, icon, toast, uid } = U;

  const ACCENT_SWATCHES = [
    '#1f2937', '#1d4ed8', '#0f766e', '#9a3412',
    '#6d28d9', '#b91c1c', '#0e7490', '#4b5563',
  ];

  const HEADING_OPTIONS = [
    { id: 'plain', name: '无装饰', preview: 'cv-h-plain' },
    { id: 'underline', name: '下划线', preview: 'cv-h-underline' },
    { id: 'bar', name: '竖线', preview: 'cv-h-bar' },
    { id: 'block', name: '色块', preview: 'cv-h-block' },
  ];

  function applyTheme(patch, opts = {}) {
    App.ui.applyTheme(patch);
    if (opts.toast) toast(opts.toast);
    rerender();
  }

  function rerender() {
    const body = document.getElementById('drawer-body');
    if (!body || App.currentPanel !== 'theme') return;
    const top = body.scrollTop;
    render(body);
    body.scrollTop = top;
  }

  function sectionBlock(title, sub, ...children) {
    const block = h('div', { class: 'drawer-section' });
    const head = h('div', { class: 'section-title' });
    head.append(h('h3', { text: title }));
    if (sub) head.append(h('span', { class: 'sub', text: sub }));
    block.append(head, ...children);
    return block;
  }

  function render(container) {
    container.innerHTML = '';
    const data = App.state.data;
    const theme = data.theme;

    // 1. 背景风格
    const grid = h('div', { class: 'preset-grid' });
    for (const preset of App.data.PRESETS) {
      const active = theme.presetId === preset.id;
      const card = h('button', {
        class: `preset-card${active ? ' is-on' : ''}`,
        type: 'button',
        title: preset.name,
      });
      const paper = h('div', { class: 'preset-paper' });
      paper.style.background = preset.background;
      paper.style.setProperty('--p-accent', preset.accent);
      paper.append(
        h('i', { class: 'pp-line pp-name' }),
        h('i', { class: 'pp-line pp-sub' }),
        h('i', { class: 'pp-line pp-sec' }),
        h('i', { class: 'pp-line pp-text' }),
        h('i', { class: 'pp-line pp-text short' }),
      );
      card.append(paper, h('span', { class: 'preset-name', text: preset.name }));
      card.addEventListener('click', () => {
        applyTheme({
          presetId: preset.id,
          accent: preset.accent,
          font: preset.font,
          heading: preset.heading,
          background: preset.background,
        });
      });
      grid.append(card);
    }
    // 小鲸鱼：🐳 / 🐋 按顺序奇偶交替
    const whaleBlock = sectionBlock('模块小鲸鱼', '🐳 🐋 交替');
    const whalePreview = h('div', { class: 'whale-preview' });
    whalePreview.append(
      h('span', { class: 'whale-preview-item', text: '🐳' }),
      h('span', { class: 'muted', text: '奇数板块' }),
      h('span', { class: 'whale-preview-item', text: '🐋' }),
      h('span', { class: 'muted', text: '偶数板块' }),
    );
    const whaleToggle = h('div', { class: 'row between', style: 'margin-top:8px' });
    whaleToggle.append(h('span', { class: 'muted', text: '在板块标题前显示小鲸鱼' }));
    whaleToggle.append(
      switchControl(Boolean(theme.whales), (on) => {
        App.ui.applyTheme({ whales: on });
        App.ui.refreshPanel();
      }),
    );
    whaleBlock.append(
      whalePreview,
      whaleToggle,
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '按板块从上到下的顺序，奇数用 🐳、偶数用 🐋；拖动排序后会重新排。'),
    );

    // 左侧 arXiv 风格标记
    const stamp = theme.stamp;
    const stampBlock = sectionBlock('左侧标记', 'arXiv 论文式竖排编号');
    const stampToggle = h('div', { class: 'row between' });
    stampToggle.append(h('span', { class: 'muted', text: '显示左侧竖排标记' }));
    stampToggle.append(
      switchControl(Boolean(stamp.enabled), (on) => {
        stamp.enabled = on;
        App.render.page();
        App.state.scheduleSave();
        App.ui.refreshPanel();
      }),
    );

    const stampList = h('div', { class: 'stamp-list' });
    stamp.columns.forEach((col, idx) => {
      const row = h('div', { class: 'stamp-row' });
      const input = h('input', {
        class: 'input',
        value: col.text,
        placeholder: App.data.DEFAULT_STAMP,
        'aria-label': `左侧标记第 ${idx + 1} 列`,
      });
      input.addEventListener('input', () => {
        col.text = input.value;
        App.render.stamps();
        App.state.scheduleSave();
      });
      const remove = h('button', {
        class: 'icon-btn',
        type: 'button',
        title: '删除这一列',
        'aria-label': '删除这一列',
        html: icon('trash', 13),
      });
      remove.disabled = stamp.columns.length <= 1;
      remove.addEventListener('click', () => {
        if (stamp.columns.length <= 1) return;
        stamp.columns.splice(idx, 1);
        App.render.page();
        App.state.scheduleSave();
        App.ui.refreshPanel();
      });
      row.append(input, remove);
      stampList.append(row);
    });

    const addStamp = h('button', { class: 'btn block', type: 'button', style: 'margin-top:8px' });
    addStamp.innerHTML = `${icon('plus', 13)}<span>添加一列（最多 3 列）</span>`;
    addStamp.disabled = stamp.columns.length >= 3;
    addStamp.addEventListener('click', () => {
      if (stamp.columns.length >= 3) return;
      stamp.columns.push({ id: uid('stamp'), text: App.data.DEFAULT_STAMP });
      App.render.page();
      App.state.scheduleSave();
      App.ui.refreshPanel();
    });

    const sizeHead = h('div', { class: 'slider-head', style: 'margin-top:14px' });
    sizeHead.append(h('span', { text: '字号' }), h('span', { class: 'slider-val', text: `${stamp.size}px` }));
    const sizeInput = h('input', {
      class: 'slider',
      type: 'range',
      min: '9',
      max: '18',
      step: '1',
      value: String(stamp.size),
      'aria-label': '左侧标记字号',
    });
    sizeInput.addEventListener('input', () => {
      stamp.size = Number(sizeInput.value);
      sizeHead.lastChild.textContent = `${stamp.size}px`;
      App.render.stamps();
      App.state.scheduleSave();
    });

    stampBlock.append(
      stampToggle,
      stampList,
      addStamp,
      sizeHead,
      sizeInput,
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, '格式示例：arXiv:2610.22286v1 [math.DS] 15 Oct 2026。最多 3 列，从左往右依次排开；纸上直接点标记也能改。'),
    );

    const styleBlock = sectionBlock('背景风格', '点一下立即套用', grid);
    const aiBtn = h('button', { class: 'btn block', type: 'button', style: 'margin-top:10px' });
    aiBtn.innerHTML = `${icon('sparkle', 14)}<span>让 AI 按描述生成一套风格</span>`;
    aiBtn.addEventListener('click', () => App.ui.openPanel('ai'));
    styleBlock.append(aiBtn);

    // 2. 主色
    const swatches = h('div', { class: 'swatches' });
    for (const color of ACCENT_SWATCHES) {
      const btn = h('button', {
        class: `swatch${theme.accent.toLowerCase() === color.toLowerCase() ? ' is-on' : ''}`,
        type: 'button',
        title: color,
        'aria-label': color,
      });
      btn.style.background = color;
      btn.addEventListener('click', () => applyTheme({ accent: color, presetId: '' }));
      swatches.append(btn);
    }
    const customWrap = h('label', { class: 'swatch swatch-custom', title: '自定义主色' });
    customWrap.style.background =
      'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #3b82f6, #8b5cf6, #ef4444)';
    const colorInput = h('input', { type: 'color', value: toHex6(theme.accent), 'aria-label': '自定义主色' });
    colorInput.addEventListener('input', () => {
      App.ui.applyTheme({ accent: colorInput.value, presetId: '' });
    });
    colorInput.addEventListener('change', () => rerender());
    customWrap.append(colorInput);
    swatches.append(customWrap);

    // 3. 行间密度（字号在下方「排版」里单独设置）
    const densitySeg = segControl(
      [
        { id: 'normal', label: '标准' },
        { id: 'compact', label: '紧凑' },
      ],
      theme.density,
      (id) => applyTheme({ density: id }),
    );

    // 4. 标题样式
    const headingGrid = h('div', { class: 'heading-grid' });
    for (const opt of HEADING_OPTIONS) {
      const btn = h('button', {
        class: `heading-option${theme.heading === opt.id ? ' is-on' : ''}`,
        type: 'button',
        title: opt.name,
      });
      const demo = h('div', { class: `heading-demo ${opt.preview}` });
      demo.style.setProperty('--p-accent', theme.accent);
      demo.append(h('span', { text: '板块标题' }));
      btn.append(demo, h('span', { class: 'heading-name', text: opt.name }));
      btn.addEventListener('click', () => applyTheme({ heading: opt.id, presetId: '' }));
      headingGrid.append(btn);
    }

    // 5. 头像
    const meta = data.meta;
    const avatarRow = h('div', { class: 'avatar-row' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const dataUrl = await U.readFileAsDataURL(file);
        const small = await downscaleImage(dataUrl, 520);
        meta.photo = small;
        meta.showPhoto = true;
        App.ui.refreshData();
        toast('头像已更新');
        rerender();
      } catch (err) {
        toast(err.message || '头像上传失败', { error: true });
      }
    });
    const uploadBtn = h('button', { class: 'btn', type: 'button' });
    uploadBtn.innerHTML = `${icon('upload', 13)}<span>上传头像</span>`;
    uploadBtn.addEventListener('click', () => fileInput.click());
    avatarRow.append(fileInput, uploadBtn);

    if (meta.photo) {
      const removeBtn = h('button', { class: 'btn', type: 'button' }, '移除');
      removeBtn.addEventListener('click', () => {
        meta.photo = '';
        meta.showPhoto = false;
        App.ui.refreshData();
        rerender();
      });
      avatarRow.append(removeBtn);
    }

    const toggleRow = h('div', { class: 'row between', style: 'margin-top:10px' });
    toggleRow.append(h('span', { class: 'muted', text: '在基本信息右侧显示头像' }));
    toggleRow.append(
      switchControl(Boolean(meta.showPhoto), (on) => {
        meta.showPhoto = on;
        App.ui.refreshData();
        rerender();
      }),
    );

    const themeBlock = h('div', { class: 'drawer-section' });
    themeBlock.append(
      sectionTitle('主色'),
      swatches,
      h('div', { style: 'height:14px' }),
      sectionTitle('行间密度', '只影响间距，不影响字号'),
      densitySeg,
    );

    // 4. 排版：基本信息 / 正文主体 / 各节标题
    const type = theme.type;
    if (!App.state.typeTab) App.state.typeTab = 'info';
    const typeBlock = sectionBlock('排版', '三组分别设；基本信息可单行覆盖');
    const typeTabs = segControl(
      [
        { id: 'info', label: '基本信息' },
        { id: 'body', label: '正文主体' },
        { id: 'heading', label: '各节标题' },
      ],
      App.state.typeTab,
      (id) => {
        App.state.typeTab = id;
        rerender();
      },
    );
    typeBlock.append(typeTabs);

    const activeType = App.state.typeTab;
    const group = type[activeType];
    const applyType = () => {
      App.render.type();
      App.state.scheduleSave();
      App.ui.updateScale();
    };

    const fontRow = h('div', { class: 'typography-row' });
    fontRow.append(
      h('div', { class: 'field-label', text: '字体' }),
      segControl(
        [
          { id: 'sans', label: '无衬线' },
          { id: 'serif', label: '衬线' },
        ],
        group.font,
        (id) => {
          group.font = id;
          applyType();
          rerender();
        },
      ),
    );
    typeBlock.append(fontRow);

    const sizeRows = [
      {
        key: 'size',
        label: '字号',
        min: 9,
        max: activeType === 'heading' ? 28 : activeType === 'info' ? 32 : 20,
        value: group.size,
      },
    ];
    for (const row of sizeRows) {
      typeBlock.append(
        rangeRow(row.label, {
          min: row.min,
          max: row.max,
          value: row.value,
          onInput: (v) => {
            group[row.key] = v;
            applyType();
          },
        }),
      );
    }

    if (activeType === 'info') {
      const weightRow = h('div', { class: 'typography-row' });
      weightRow.append(
        h('div', { class: 'field-label', text: '字重' }),
        segControl(
          [
            { id: 400, label: '常规' },
            { id: 650, label: '加粗' },
          ],
          group.weight || 400,
          (id) => {
            group.weight = id;
            applyType();
            rerender();
          },
        ),
      );
      typeBlock.append(weightRow);
    }

    typeBlock.append(
      colorRow(
        '文字颜色',
        group.color,
        (color) => {
          group.color = color;
          applyType();
          rerender();
        },
        {
          follow: activeType === 'heading',
          followColor: theme.accent,
          fallbackColor: activeType === 'heading' ? theme.accent : group.color,
          onLive: (color) => {
            group.color = color;
            applyType();
          },
        },
      ),
    );

    if (activeType === 'info') {
      const applyAll = h('button', { class: 'btn ghost block', type: 'button' }, '统一应用到所有行');
      applyAll.addEventListener('click', () => {
        let count = 0;
        for (const sec of data.sections) {
          if (sec.kind !== 'info') continue;
          for (const it of sec.items) {
            if (it.style) {
              it.style = null;
              count += 1;
            }
          }
        }
        App.render.page();
        App.state.scheduleSave();
        App.ui.updateScale();
        toast(count ? '已用统一设置覆盖所有信息行' : '所有信息行已经在用统一设置');
        rerender();
      });
      typeBlock.append(
        applyAll,
        h(
          'p',
          { class: 'muted', style: 'margin:6px 0 0' },
          '单行样式：鼠标移到纸上该行，点右侧的 Aa；上面的按钮会清除单行样式。',
        ),
      );
    }

    const headingBlock = sectionBlock('板块标题样式', '', headingGrid);
    const avatarBlock = sectionBlock('头像', '', avatarRow, toggleRow);

    const resetBlock = sectionBlock('', '');
    const resetBtn = h('button', { class: 'btn block', type: 'button' }, '恢复默认主题');
    resetBtn.addEventListener('click', () => {
      const preset = App.data.PRESETS.find((p) => p.id === 'blue') || App.data.PRESETS[0];
      data.theme.type = U.deepClone(App.data.DEFAULT_DATA.theme.type);
      applyTheme({
        presetId: preset.id,
        accent: preset.accent,
        font: preset.font,
        heading: preset.heading,
        background: preset.background,
        density: 'normal',
      }, { toast: '已恢复默认主题' });
    });
    resetBlock.append(resetBtn);

    const watermark = theme.watermark || {};
    const watermarkBlock = sectionBlock('背景水印', '右上角 · DeepSeek 鲸鱼');
    const watermarkToggle = h('div', { class: 'row between' });
    watermarkToggle.append(h('span', { class: 'muted', text: '显示右上角鲸鱼水印' }));
    watermarkToggle.append(
      switchControl(Boolean(watermark.enabled), (on) => {
        watermark.enabled = on;
        App.ui.applyTheme({ watermark });
        rerender();
      }),
    );

    const wmOpacityRow = h('div', { class: 'typography-row' });
    const wmOpacityHead = h('div', { class: 'slider-head' });
    const wmOpacityValue = h('span', { class: 'slider-val', text: `${Math.round((watermark.opacity ?? 0.5) * 100)}%` });
    wmOpacityHead.append(h('span', { text: '透明度' }), wmOpacityValue);
    const wmOpacity = h('input', {
      class: 'slider',
      type: 'range',
      min: '10',
      max: '90',
      step: '5',
      value: String(Math.round((watermark.opacity ?? 0.5) * 100)),
      'aria-label': '水印透明度',
    });
    wmOpacity.addEventListener('input', () => {
      watermark.opacity = Number(wmOpacity.value) / 100;
      wmOpacityValue.textContent = `${wmOpacity.value}%`;
      App.ui.applyTheme({ watermark });
    });
    wmOpacityRow.append(wmOpacityHead, wmOpacity);

    const wmSizeRow = h('div', { class: 'typography-row' });
    const wmSizeHead = h('div', { class: 'slider-head' });
    const wmSizeValue = h('span', { class: 'slider-val', text: `${Math.round(watermark.width ?? 36)}mm` });
    wmSizeHead.append(h('span', { text: '大小' }), wmSizeValue);
    const wmSize = h('input', {
      class: 'slider',
      type: 'range',
      min: '20',
      max: '60',
      step: '2',
      value: String(Math.round(watermark.width ?? 36)),
      'aria-label': '水印大小',
    });
    wmSize.addEventListener('input', () => {
      watermark.width = Number(wmSize.value);
      wmSizeValue.textContent = `${wmSize.value}mm`;
      App.ui.applyTheme({ watermark });
    });
    wmSizeRow.append(wmSizeHead, wmSize);
    watermarkBlock.append(
      watermarkToggle,
      wmOpacityRow,
      wmSizeRow,
      h('p', { class: 'muted', style: 'margin:2px 0 0' }, '官方 DeepSeek 鲸鱼图标；默认 50% 透明度，随 PDF 一起打印。'),
    );

    const advancedBlock = h('details', { class: 'drawer-section advanced-section' });
    advancedBlock.open = Boolean(App.state.advancedOpen);
    advancedBlock.addEventListener('toggle', () => {
      App.state.advancedOpen = advancedBlock.open;
    });
    advancedBlock.append(
      h('summary', { class: 'advanced-summary' }, '个性装饰 / 高级（开发者）'),
      h(
        'p',
        { class: 'muted advanced-hint' },
        '小鲸鱼、arXiv 标记、DeepSeek 水印等。普通简历不需要；想用再展开。',
      ),
      watermarkBlock,
      whaleBlock,
      stampBlock,
    );
    container.append(typeBlock, themeBlock, styleBlock, headingBlock, avatarBlock, advancedBlock, resetBlock);
  }

  function rangeRow(label, opts) {
    const row = h('div', { class: 'typography-row' });
    const head = h('div', { class: 'slider-head' });
    const value = h('span', { class: 'slider-val', text: `${opts.value}px` });
    head.append(h('span', { text: label }), value);
    const input = h('input', {
      class: 'slider',
      type: 'range',
      min: String(opts.min),
      max: String(opts.max),
      step: '1',
      value: String(opts.value),
      'aria-label': label,
    });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value.textContent = `${v}px`;
      opts.onInput(v);
    });
    row.append(head, input);
    return row;
  }

  function colorRow(label, value, onChange, opts = {}) {
    const row = h('div', { class: 'typography-row' });
    row.append(h('div', { class: 'field-label', text: label }));
    const wrap = h('div', { class: 'swatches' });
    const current = String(value || '').toLowerCase();

    if (opts.follow) {
      const btn = h('button', {
        class: `swatch${current === '' ? ' is-on' : ''}`,
        type: 'button',
        title: '跟随主色',
        'aria-label': '跟随主色',
      });
      btn.style.background = opts.followColor || '#1d4ed8';
      btn.append(h('span', { class: 'swatch-auto', text: 'A' }));
      btn.addEventListener('click', () => onChange(''));
      wrap.append(btn);
    }

    for (const color of ACCENT_SWATCHES) {
      const btn = h('button', {
        class: `swatch${current === color.toLowerCase() ? ' is-on' : ''}`,
        type: 'button',
        title: color,
        'aria-label': color,
      });
      btn.style.background = color;
      btn.addEventListener('click', () => onChange(color));
      wrap.append(btn);
    }

    const custom = h('label', { class: 'swatch swatch-custom', title: '自定义颜色' });
    custom.style.background =
      'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #3b82f6, #8b5cf6, #ef4444)';
    const input = h('input', {
      type: 'color',
      value: toHex6(opts.fallbackColor || value || '#3f4652'),
      'aria-label': '自定义颜色',
    });
    input.addEventListener('input', () => {
      if (opts.onLive) opts.onLive(input.value);
    });
    input.addEventListener('change', () => onChange(input.value));
    custom.append(input);
    wrap.append(custom);

    row.append(wrap);
    return row;
  }

  function sectionTitle(text, sub) {
    if (!text) return h('span');
    const row = h('div', { class: 'section-title' });
    row.append(h('h3', { text }));
    if (sub) row.append(h('span', { class: 'sub', text: sub }));
    return row;
  }

  function segControl(options, current, onChange) {
    const seg = h('div', { class: 'seg' });
    for (const opt of options) {
      const btn = h('button', {
        class: opt.id === current ? 'is-on' : '',
        type: 'button',
        text: opt.label,
      });
      btn.addEventListener('click', () => onChange(opt.id));
      seg.append(btn);
    }
    return seg;
  }

  function switchControl(on, onChange) {
    const btn = h('button', {
      class: `switch${on ? ' is-on' : ''}`,
      type: 'button',
      role: 'switch',
      'aria-checked': String(on),
      'aria-label': '切换',
    });
    btn.append(h('span', { class: 'switch-dot' }));
    btn.addEventListener('click', () => onChange(!on));
    return btn;
  }

  function toHex6(color) {
    const c = String(color || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    return '#1d4ed8';
  }

  function downscaleImage(dataUrl, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const hgt = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = hgt;
        const ctx = canvas.getContext('2d');
        // 透明背景转 JPEG 会变黑，先铺一层白
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, hgt);
        ctx.drawImage(img, 0, 0, w, hgt);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('这张图片读不出来，换一张试试'));
      img.src = dataUrl;
    });
  }

  App.panels = App.panels || {};
  App.panels.theme = { render };
})();
