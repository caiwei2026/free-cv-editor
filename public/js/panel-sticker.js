/* 贴图面板：内置图案、上传图片、AI 生成入口、选中贴图的属性 */
(function () {
  const App = window.App;
  const U = App.util;
  const { h, icon, toast } = U;

  const COLORS = ['', '#1f2937', '#1d4ed8', '#0f766e', '#9a3412', '#6d28d9', '#b91c1c', '#0e7490'];

  function render(container) {
    const data = App.state.data;
    const selected = data.stickers.find((s) => s.id === App.state.selectedSticker) || null;

    // 内置贴图
    const grid = h('div', { class: 'sticker-grid' });
    for (const item of App.data.STICKERS) {
      const tile = h('button', { class: 'sticker-tile', type: 'button', title: `添加「${item.name}」` });
      const holder = h('div', { class: 'sticker-tile-art' });
      holder.innerHTML = item.svg;
      holder.style.color = data.theme.accent;
      tile.append(holder);
      tile.addEventListener('click', () => {
        const st = App.render.addSticker({
          svg: item.svg,
          name: item.name,
          tintable: item.tintable,
        });
        App.render.selectSticker(st.id);
        App.ui.refreshPanel();
        toast(`已添加贴图「${item.name}」`);
      });
      grid.append(tile);
    }

    const builtinBlock = section('内置贴图', '点一下加到纸上', grid);

    // 上传 & AI
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg',
      style: { display: 'none' },
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        if (file.size > 4 * 1024 * 1024) throw new Error('图片超过 4MB，先压缩一下再上传');
        const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
        if (isSvg) {
          const text = await file.text();
          const svg = U.sanitizeSvg(text);
          if (!svg) throw new Error('这个 SVG 里没有可用的图形');
          const st = App.render.addSticker({ svg, name: file.name.replace(/\.svg$/i, ''), tintable: false });
          App.render.selectSticker(st.id);
        } else {
          const dataUrl = await U.readFileAsDataURL(file);
          const png = await fitImage(dataUrl, 700);
          const st = App.render.addSticker({ src: png, name: file.name.replace(/\.[^.]+$/, ''), tintable: false });
          App.render.selectSticker(st.id);
        }
        App.ui.refreshPanel();
        toast('贴图已添加，直接拖动就能挪位置');
      } catch (err) {
        toast(err.message || '上传失败', { error: true });
      }
    });

    const uploadBtn = h('button', { class: 'btn', type: 'button' });
    uploadBtn.innerHTML = `${icon('upload', 13)}<span>上传图片 / SVG</span>`;
    uploadBtn.addEventListener('click', () => fileInput.click());

    const aiBtn = h('button', { class: 'btn accent', type: 'button' });
    aiBtn.innerHTML = `${icon('sparkle', 13)}<span>AI 生成贴图</span>`;
    aiBtn.addEventListener('click', () => App.ui.openPanel('ai'));

    const actions = h('div', { class: 'btn-row' });
    actions.append(uploadBtn, aiBtn);
    const uploadBlock = section('自己的图', 'PNG / JPG / SVG 都可以', fileInput, actions);

    // 当前贴图
    const listBlock = h('div', { class: 'drawer-section' });
    listBlock.append(sectionHead('纸上的贴图', `${data.stickers.length} 个`));
    if (!data.stickers.length) {
      listBlock.append(h('p', { class: 'muted' }, '还没有贴图。加一个之后，可以用鼠标拖动、拉右下角缩放。'));
    } else {
      const list = h('div', { class: 'sticker-list' });
      for (const st of data.stickers) {
        const row = h('div', {
          class: `sticker-row${selected && selected.id === st.id ? ' is-on' : ''}`,
          title: '点击选中',
        });
        const thumb = h('div', { class: 'sticker-thumb' });
        if (st.svg) thumb.innerHTML = st.svg;
        else if (st.src) thumb.append(h('img', { src: st.src, alt: st.name }));
        row.append(thumb);
        row.append(
          h('div', { class: 'sticker-meta' }, h('strong', { text: st.name }), h('span', { text: `${Math.round(st.w)} mm · ${st.rot}°` })),
        );
        const del = h('button', { class: 'mini-icon danger', type: 'button', title: '删除贴图', html: icon('trash', 13) });
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          App.render.removeSticker(st.id);
          App.ui.refreshPanel();
        });
        row.append(del);
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          App.render.selectSticker(st.id);
          App.ui.refreshPanel();
          const node = document.querySelector(`.sticker[data-stid="${st.id}"]`);
          node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        list.append(row);
      }
      listBlock.append(list);
    }

    container.append(builtinBlock, uploadBlock, listBlock);

    if (selected) {
      container.append(renderStickerProps(selected));
    } else if (data.stickers.length) {
      const hint = h('div', { class: 'drawer-section' });
      hint.append(h('p', { class: 'muted' }, '点纸上任意一个贴图，或点上面的列表，就能调大小、旋转和透明度。'));
      container.append(hint);
    }
  }

  function renderStickerProps(st) {
    const block = h('div', { class: 'drawer-section' });
    block.append(sectionHead('调整贴图', st.name));

    const apply = () => {
      App.render.stickers();
      App.state.scheduleSave();
    };

    block.append(
      slider({
        label: '大小',
        min: 4,
        max: 100,
        step: 0.5,
        value: st.w,
        suffix: ' mm',
        onInput: (v) => {
          st.w = v;
          apply();
        },
      }),
      slider({
        label: '旋转',
        min: -180,
        max: 180,
        step: 1,
        value: st.rot,
        suffix: '°',
        onInput: (v) => {
          st.rot = v;
          apply();
        },
      }),
      slider({
        label: '不透明度',
        min: 10,
        max: 100,
        step: 1,
        value: Math.round(st.opacity * 100),
        suffix: '%',
        onInput: (v) => {
          st.opacity = v / 100;
          apply();
        },
      }),
    );

    if (st.tintable) {
      const swatches = h('div', { class: 'swatches' });
      COLORS.forEach((color) => {
        const btn = h('button', {
          class: `swatch${(st.color || '') === color ? ' is-on' : ''}`,
          type: 'button',
          title: color || '跟随主色',
          'aria-label': color || '跟随主色',
        });
        if (color) btn.style.background = color;
        else {
          btn.style.background = 'var(--accent)';
          btn.style.border = '1.5px dashed rgba(0,0,0,.28)';
          btn.append(h('span', { class: 'swatch-auto', text: 'A' }));
        }
        btn.addEventListener('click', () => {
          st.color = color;
          App.ui.refreshPanel();
          apply();
        });
        swatches.append(btn);
      });
      const colorRow = h('div', { class: 'field' });
      colorRow.append(h('span', { class: 'field-label', text: '颜色' }), swatches);
      block.append(colorRow);
    }

    const row = h('div', { class: 'btn-row', style: 'margin-top:10px' });
    const dupBtn = h('button', { class: 'btn block', type: 'button' });
    dupBtn.innerHTML = `${icon('copy', 13)}<span>复制一份</span>`;
    dupBtn.addEventListener('click', () => {
      App.render.duplicateSticker(st.id);
      App.ui.refreshPanel();
    });
    row.append(dupBtn);

    const delBtn = h('button', { class: 'btn block', type: 'button', style: 'margin-top:8px;color:#b23c2e' }, '删除这个贴图');
    delBtn.addEventListener('click', () => {
      App.render.removeSticker(st.id);
      App.ui.refreshPanel();
    });

    block.append(row, delBtn);
    return block;
  }

  function slider({ label, min, max, step, value, suffix, onInput }) {
    const row = h('div', { class: 'slider-row' });
    const head = h('div', { class: 'slider-head' });
    const name = h('span', { text: label });
    const val = h('span', { class: 'slider-val', text: `${round(value)}${suffix}` });
    head.append(name, val);
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
    input.className = 'slider';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      val.textContent = `${round(v)}${suffix}`;
      onInput(v);
    });
    row.append(head, input);
    return row;
  }

  function round(n) {
    const v = Math.round(Number(n) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  function section(title, sub, ...children) {
    const block = h('div', { class: 'drawer-section' });
    block.append(sectionHead(title, sub));
    block.append(...children);
    return block;
  }

  function sectionHead(title, sub) {
    const row = h('div', { class: 'section-title' });
    row.append(h('h3', { text: title }));
    if (sub) row.append(h('span', { class: 'sub', text: sub }));
    return row;
  }

  function fitImage(dataUrl, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const hgt = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = hgt;
        canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('这张图片读不出来，换一张试试'));
      img.src = dataUrl;
    });
  }

  App.panels = App.panels || {};
  App.panels.sticker = { render };
})();
