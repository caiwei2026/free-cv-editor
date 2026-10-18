/* 简历纸面渲染 + 就地编辑 + 贴图层交互 + 左侧板块列表 */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const { h, icon, uid, toast, clamp, focusEnd, normalizeEditable, sanitizeSvg } = U;

  const PLAINTEXT_OK = (() => {
    const d = document.createElement('div');
    d.contentEditable = 'plaintext-only';
    return d.contentEditable === 'plaintext-only';
  })();

  const state = () => App.state;
  const pageEl = () => document.getElementById('page');
  const scrollEl = () => document.getElementById('stage-scroll');

  // ---------------- 可编辑文字 ----------------
  const focus = { node: null, obj: null, field: null };
  App.focus = focus;

  const ceRegistry = new WeakMap();

  function setFocusTarget(node, obj, field) {
    focus.node = node;
    focus.obj = obj;
    focus.field = field;
    const sec = node.closest('.cv-sec');
    setActiveSection(sec ? sec.dataset.sid : null);
  }

  function ce(obj, field, opts = {}) {
    const {
      tag = 'span',
      placeholder = '',
      className = '',
      singleLine = true,
      onKey = null,
    } = opts;
    const node = h(tag, {
      class: `ce ${className}`.trim(),
      'data-ph': placeholder,
      contenteditable: PLAINTEXT_OK ? 'plaintext-only' : 'true',
      spellcheck: 'false',
    });
    node.textContent = obj[field] || '';

    ceRegistry.set(node, { obj, field });

    node.addEventListener('focus', () => setFocusTarget(node, obj, field));

    node.addEventListener('input', () => {
      const raw = node.innerText.replace(/\u00a0/g, ' ');
      obj[field] = singleLine ? raw.replace(/\s*\n+\s*/g, ' ') : raw.replace(/\n{3,}/g, '\n\n');
      state().scheduleSave();
      if (field === 'title' && obj === currentSectionObj(node)) refreshOutlineTitle();
    });

    node.addEventListener('blur', () => {
      normalizeEditable(node);
      if (singleLine) obj[field] = U.textOf(node).replace(/\s+/g, ' ');
    });

    node.addEventListener('keydown', (e) => {
      if (singleLine && e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        node.blur();
      }
      if (onKey) onKey(e, node);
    });

    node.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text == null) return;
      e.preventDefault();
      const clean = singleLine ? text.replace(/\s*\n+\s*/g, ' ') : text.replace(/\r/g, '');
      document.execCommand('insertText', false, clean);
    });

    return node;
  }

  // 鼠标点选时立刻记录目标，不完全依赖 focus 事件（部分环境里可能不触发）
  document.addEventListener(
    'pointerdown',
    (event) => {
      const node = event.target instanceof Element ? event.target.closest('.ce') : null;
      if (!node) return;
      const meta = ceRegistry.get(node);
      if (meta) setFocusTarget(node, meta.obj, meta.field);
    },
    true,
  );

  function currentSectionObj(node) {
    const secEl = node.closest('.cv-sec');
    if (!secEl) return null;
    return state().data.sections.find((s) => s.id === secEl.dataset.sid) || null;
  }

  function setActiveSection(sid) {
    state().activeSection = sid;
    document.querySelectorAll('.outline-row').forEach((row) => {
      row.classList.toggle('is-active', row.dataset.sid === sid);
    });
    document.querySelectorAll('.cv-sec').forEach((sec) => {
      sec.classList.toggle('is-active', sec.dataset.sid === sid);
    });
  }

  function refreshOutlineTitle() {
    renderOutline();
  }

  function focusSelector(selector, { atEnd = true, scroll = true } = {}) {
    requestAnimationFrame(() => {
      const node = document.querySelector(selector);
      if (!node) return;
      if (atEnd) focusEnd(node);
      else node.focus();
      if (scroll) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  // ---------------- 板块与条目 ----------------
  function renderSection(sec) {
    const el = h('section', { class: 'cv-sec', dataset: { sid: sec.id } });

    const tools = h('div', { class: 'cv-sec-tools' });
    tools.append(toolBtn('plus', () => addItem(sec), '添加条目'));
    tools.append(
      toolBtn(
        sec.hideTitle ? 'eyeOff' : 'eye',
        () => toggleSectionTitle(sec),
        sec.hideTitle ? '显示板块标题' : '隐藏板块标题',
      ),
    );
    tools.append(toolBtn('up', () => moveSection(sec, -1), '上移板块'));
    tools.append(toolBtn('down', () => moveSection(sec, 1), '下移板块'));
    tools.append(toolBtn('trash', () => removeSection(sec), '删除板块', true));
    el.append(tools);
    bindToolsHover(el, tools);

    if (!sec.hideTitle) {
      const head = h('div', { class: 'cv-sec-head' });
      if (state().data.theme.whales) head.append(whaleEmoji(sec));
      head.append(
        ce(sec, 'title', { tag: 'h2', placeholder: '板块标题', className: 'cv-sec-title' }),
      );
      el.append(head);
    }

    const body = h('div', { class: 'cv-sec-body' });
    if (sec.kind === 'info') {
      const wrap = h('div', { class: 'cv-info' });
      const main = h('div', { class: 'cv-info-main' });
      sec.items.forEach((item) => main.append(renderItem(sec, item)));
      wrap.append(main);

      const meta = state().data.meta;
      if (meta.showPhoto && meta.photo) {
        const img = h('img', { class: 'cv-avatar', src: meta.photo, alt: '头像', title: '点击更换头像' });
        img.addEventListener('click', () => App.ui.openPanel('theme'));
        wrap.append(img);
      } else if (meta.showPhoto) {
        const ph = h('button', { class: 'cv-avatar cv-avatar-empty', type: 'button', title: '上传头像' }, '＋ 头像');
        ph.addEventListener('click', () => App.ui.openPanel('theme'));
        wrap.append(ph);
      }
      body.append(wrap);
    } else {
      sec.items.forEach((item) => body.append(renderItem(sec, item)));
    }
    if (!sec.items.length) {
      const empty = h('div', { class: 'cv-empty' });
      if (sec.kind === 'info') empty.textContent = '还没有内容，点板块标题右侧的「＋」加一行。';
      else if (sec.kind === 'text') empty.textContent = '还没有内容，点板块标题右侧的「＋」加一段。';
      else if (sec.kind === 'tags') empty.textContent = '还没有内容，点板块标题右侧的「＋」加一行技能。';
      else if (sec.kind === 'list') empty.textContent = '还没有内容，点板块标题右侧的「＋」加一条。';
      else empty.textContent = '还没有内容，点板块标题右侧的「＋」加一条经历。';
      body.append(empty);
    }
    el.append(body);
    return el;
  }

  function whaleEmojiFor(sec) {
    const visible = state().data.sections.filter((s) => s.visible);
    const index = visible.indexOf(sec);
    return index % 2 === 0 ? '🐳' : '🐋';
  }

  function whaleEmoji(sec, className = 'cv-whale') {
    const span = h('span', { class: className, 'aria-hidden': 'true' });
    span.textContent = whaleEmojiFor(sec);
    return span;
  }

  function bindToolsHover(el, tools) {
    let timer = 0;
    const open = () => {
      clearTimeout(timer);
      el.classList.add('tools-open');
    };
    const closeLater = () => {
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('tools-open'), 280);
    };
    el.addEventListener('pointerenter', open);
    el.addEventListener('pointerleave', closeLater);
    tools.addEventListener('pointerenter', open);
    tools.addEventListener('pointerleave', closeLater);
  }

  let pagePop = null;

  function closePagePop() {
    if (pagePop) {
      pagePop.remove();
      pagePop = null;
    }
  }

  function openPagePop(anchor, build) {
    closePagePop();
    const pop = h('div', { class: 'page-pop' });
    build(pop);
    document.body.append(pop);
    const rect = anchor.getBoundingClientRect();
    const width = pop.offsetWidth || 252;
    const height = pop.offsetHeight || 240;
    let left = rect.left - width - 10;
    if (left < 12) left = Math.min(window.innerWidth - width - 12, rect.right + 10);
    let top = rect.top;
    if (top + height > window.innerHeight - 12) top = window.innerHeight - height - 12;
    if (top < 12) top = 12;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pagePop = pop;
    return pop;
  }

  function popHead(title) {
    const head = h('div', { class: 'page-pop-head' });
    head.append(h('span', { class: 'page-pop-title' }, title));
    const x = h('button', { class: 'page-pop-x', type: 'button', title: '关闭', 'aria-label': '关闭' }, '×');
    x.addEventListener('click', closePagePop);
    head.append(x);
    return head;
  }

  function popRow(label, ...children) {
    const row = h('div', { class: 'page-pop-row' });
    row.append(h('span', { class: 'page-pop-label' }, label), ...children);
    return row;
  }

  function popSeg(options, active, onPick) {
    const seg = h('div', { class: 'page-pop-seg' });
    for (const opt of options) {
      const btn = h('button', { type: 'button', class: opt.value === active ? 'is-on' : '' }, opt.label);
      btn.addEventListener('click', () => {
        onPick(opt.value);
        [...seg.children].forEach((b) => b.classList.toggle('is-on', b === btn));
      });
      seg.append(btn);
    }
    return seg;
  }

  function popColors(active, fallback, onPick) {
    const palette = ['#111827', '#1d4ed8', '#0f766e', '#b45309', '#b91c1c', '#6d28d9', '#0e7490', '#475569'];
    const wrap = h('div', { class: 'page-pop-swatches' });
    for (const color of palette) {
      const swatch = h('button', {
        type: 'button',
        class: `page-pop-swatch${active === color ? ' is-on' : ''}`,
        style: `background:${color}`,
        title: color,
        'aria-label': color,
      });
      swatch.addEventListener('click', () => {
        onPick(color);
        [...wrap.querySelectorAll('.page-pop-swatch')].forEach((x) => x.classList.toggle('is-on', x === swatch));
      });
      wrap.append(swatch);
    }
    const custom = h('input', {
      type: 'color',
      class: 'page-pop-color',
      value: /^#[0-9a-f]{6}$/i.test(active || '') ? active : fallback || '#23272e',
      title: '自定义颜色',
    });
    custom.addEventListener('input', () => {
      onPick(custom.value);
      wrap.querySelectorAll('.page-pop-swatch').forEach((x) => x.classList.remove('is-on'));
    });
    wrap.append(custom);
    return wrap;
  }

  function applyInfoLineStyle(item, node) {
    if (!node) return;
    const style = item.style || {};
    node.style.fontFamily =
      style.font === 'serif' ? 'var(--font-serif)' : style.font === 'sans' ? 'var(--font-sans)' : '';
    node.style.fontSize = style.size ? `${style.size}px` : '';
    node.style.fontWeight = style.weight ? String(style.weight) : '';
    node.style.color = style.color || '';
  }

  function setInfoLineStyle(item, node, key, value) {
    const style = { ...(item.style || {}) };
    if (value == null || value === '') delete style[key];
    else style[key] = value;
    item.style = Object.keys(style).length ? style : null;
    applyInfoLineStyle(item, node);
    state().scheduleSave();
    App.ui.updateScale();
  }

  function openLineStyle(item, line, anchor) {
    const group = state().data.theme.type.info;
    const current = item.style || {};
    openPagePop(anchor, (pop) => {
      pop.append(popHead('这一行样式'));
      pop.append(
        popRow(
          '字体',
          popSeg(
            [
              { value: 'sans', label: '无衬线' },
              { value: 'serif', label: '衬线' },
            ],
            current.font || group.font,
            (v) => setInfoLineStyle(item, line, 'font', v),
          ),
        ),
      );
      const size = current.size || group.size;
      const range = h('input', {
        type: 'range',
        class: 'page-pop-range',
        min: 9,
        max: 32,
        step: 1,
        value: size,
      });
      const value = h('span', { class: 'page-pop-val' }, `${size}px`);
      range.addEventListener('input', () => {
        const next = +range.value;
        value.textContent = `${next}px`;
        setInfoLineStyle(item, line, 'size', next);
      });
      pop.append(popRow('字号', range, value));
      pop.append(
        popRow(
          '字重',
          popSeg(
            [
              { value: 400, label: '常规' },
              { value: 650, label: '加粗' },
            ],
            current.weight || group.weight,
            (v) => setInfoLineStyle(item, line, 'weight', v),
          ),
        ),
      );
      pop.append(
        popRow(
          '颜色',
          popColors(current.color || '', group.color, (v) => setInfoLineStyle(item, line, 'color', v)),
        ),
      );
      pop.append(h('p', { class: 'page-pop-hint' }, '只影响这一行；统一设置改不到这里。'));
      const reset = h('button', { class: 'page-pop-btn', type: 'button' }, '跟随统一设置');
      reset.addEventListener('click', () => {
        item.style = null;
        applyInfoLineStyle(item, line);
        state().scheduleSave();
        App.ui.updateScale();
        closePagePop();
      });
      const foot = h('div', { class: 'page-pop-foot' });
      foot.append(reset);
      pop.append(foot);
    });
  }

  function openFields(item, anchor, kind = 'timeline') {
    const fields = item.fields || { title: true, date: true, meta: true };
    const isList = kind === 'list';
    openPagePop(anchor, (pop) => {
      pop.append(popHead('这一条显示'));
      const check = (label, checked, onChange, sub) => {
        const row = h('label', { class: `page-pop-check${sub ? ' is-sub' : ''}` });
        const input = h('input', { type: 'checkbox' });
        input.checked = checked;
        input.addEventListener('change', () => onChange(input.checked));
        row.append(input, h('span', {}, label));
        pop.append(row);
        return input;
      };
      const commit = (patch) => {
        item.fields = { ...fields, ...patch };
        state().scheduleSave();
        closePagePop();
        renderPage();
        App.ui.updateScale();
      };
      check('标题', fields.title !== false, (v) => commit({ title: v }));
      check('时间', fields.date !== false, (v) => commit({ date: v }));
      if (!isList) {
        check('副标题（职位 / 城市）', fields.meta !== false, (v) => commit({ meta: v }));
        const stack = check(
          '时间另起一行',
          Boolean(item.dateBelow),
          (v) => {
            item.dateBelow = v;
            state().scheduleSave();
            closePagePop();
            renderPage();
            App.ui.updateScale();
          },
          true,
        );
        stack.disabled = fields.date === false;
      }
      pop.append(h('p', { class: 'page-pop-hint' }, '用这里的开关隐藏时内容会保留；点 × 会直接清空并隐藏这一行。'));
    });
  }

  function toolAaBtn(fn, title) {
    const btn = h('button', {
      class: 'page-tool is-aa',
      type: 'button',
      title: title || '',
      'aria-label': title || '',
    }, 'Aa');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closePagePop();
      fn(e);
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    return btn;
  }

  function toolBtn(iconName, fn, title, danger) {
    const btn = h('button', {
      class: `page-tool${danger ? ' is-danger' : ''}`,
      type: 'button',
      title: title || '',
      'aria-label': title || '',
      html: icon(iconName, 11),
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closePagePop();
      fn(e);
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    return btn;
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!pagePop) return;
      if (pagePop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.page-tool')) return;
      closePagePop();
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePagePop();
  });
  document.addEventListener('scroll', () => closePagePop(), true);
  window.addEventListener('resize', closePagePop);

  function renderItem(sec, item) {
    const el = h('article', { class: 'cv-item', dataset: { iid: item.id } });

    const tools = h('div', { class: 'cv-item-tools' });
    let infoLine = null;
    if (sec.kind === 'info') {
      infoLine = ce(item, 'text', { placeholder: '姓名：你的名字', className: 'cv-info-line' });
      applyInfoLineStyle(item, infoLine);
    }
    if (sec.kind === 'timeline' || sec.kind === 'text') {
      tools.append(
        toolBtn(
          'plus',
          () => addBullet(sec, item),
          sec.kind === 'text' ? '添加一条分点' : '添加一条描述',
        ),
      );
      if (item.bullets.length) {
        tools.append(
          toolBtn(
            item.dots === false ? 'listOff' : 'list',
            () => toggleDots(item),
            item.dots === false ? '显示分点符号' : '隐藏分点符号',
          ),
        );
      }
    }
    if (sec.kind === 'timeline') {
      let fieldsBtn;
      fieldsBtn = toolBtn('sliders', () => openFields(item, fieldsBtn, 'timeline'), '显示 / 隐藏标题、时间、副标题');
      tools.append(fieldsBtn);
    }
    if (sec.kind === 'list') {
      let fieldsBtn;
      fieldsBtn = toolBtn('sliders', () => openFields(item, fieldsBtn, 'list'), '显示 / 隐藏标题、时间');
      tools.append(fieldsBtn);
    }
    if (sec.kind === 'info') {
      let styleBtn;
      styleBtn = toolAaBtn(() => openLineStyle(item, infoLine, styleBtn), '单独设置这一行样式');
      tools.append(styleBtn);
    }
    tools.append(toolBtn('up', () => moveItem(sec, item, -1), '上移'));
    tools.append(toolBtn('down', () => moveItem(sec, item, 1), '下移'));
    tools.append(toolBtn('copy', () => duplicateItem(sec, item), '复制一条'));
    tools.append(toolBtn('trash', () => removeItem(sec, item), '删除这一条', true));
    el.append(tools);
    bindToolsHover(el, tools);

    if (sec.kind === 'info') {
      el.append(infoLine);
    } else if (sec.kind === 'timeline') {
      const fields = item.fields || {};
      const showTitle = fields.title !== false;
      const showDate = fields.date !== false;
      const showMeta = fields.meta !== false;

      if (showTitle || showDate) {
        const top = h('div', { class: `cv-item-top${item.dateBelow ? ' is-stacked' : ''}` });
        if (showTitle) {
          top.append(ce(item, 'title', { placeholder: '公司 / 学校 / 项目名', className: 'cv-item-title' }));
        }
        if (showDate) {
          const dateWrap = h('span', { class: 'cv-date-wrap' });
          dateWrap.append(ce(item, 'date', { placeholder: '时间', className: 'cv-item-date' }));
          const clearDate = h(
            'button',
            { class: 'cv-date-clear', type: 'button', title: '删除这一行（可在字段菜单恢复）' },
            '×',
          );
          clearDate.addEventListener('click', () => {
            item.date = '';
            item.fields = { ...(item.fields || {}), date: false };
            renderPage();
            state().scheduleSave();
          });
          dateWrap.append(clearDate);
          top.append(dateWrap);
        }
        el.append(top);
      }

      if (showMeta) {
        const metaRow = h('div', { class: 'cv-item-meta-row' });
        metaRow.append(ce(item, 'meta', { placeholder: '职位 · 城市', className: 'cv-item-meta' }));
        const clear = h(
          'button',
          { class: 'cv-meta-clear', type: 'button', title: '删除这一行（可在字段菜单恢复）' },
          '×',
        );
        clear.addEventListener('click', () => {
          item.meta = '';
          item.fields = { ...(item.fields || {}), meta: false };
          renderPage();
          state().scheduleSave();
        });
        metaRow.append(clear);
        el.append(metaRow);
      }

      const ul = h('ul', { class: `cv-bullets${item.dots === false ? ' no-dots' : ''}` });
      item.bullets.forEach((_, idx) => ul.append(renderBullet(item, idx)));
      el.append(ul);
    } else if (sec.kind === 'text') {
      el.append(ce(item, 'text', { tag: 'p', placeholder: '写一段自我介绍…', className: 'cv-text', singleLine: false }));
      if (item.bullets.length) {
        const ul = h('ul', { class: `cv-bullets${item.dots === false ? ' no-dots' : ''}` });
        item.bullets.forEach((_, idx) => ul.append(renderBullet(item, idx)));
        el.append(ul);
      }
    } else if (sec.kind === 'tags') {
      const row = h('div', { class: 'cv-tag-row' });
      row.append(ce(item, 'title', { placeholder: '分类', className: 'cv-tag-label' }));
      row.append(ce(item, 'text', { placeholder: '关键词 1 / 关键词 2', className: 'cv-tag-value' }));
      el.append(row);
    } else if (sec.kind === 'list') {
      const fields = item.fields || {};
      const row = h('div', { class: 'cv-list-row' });
      if (fields.title !== false) {
        row.append(ce(item, 'title', { placeholder: '内容', className: 'cv-list-text' }));
      }
      if (fields.date !== false) {
        const dateWrap = h('span', { class: 'cv-list-date-wrap' });
        dateWrap.append(ce(item, 'date', { placeholder: '时间', className: 'cv-list-date' }));
        const clearDate = h(
          'button',
          { class: 'cv-date-clear', type: 'button', title: '删除这一行（可在字段菜单恢复）' },
          '×',
        );
        clearDate.addEventListener('click', () => {
          item.date = '';
          item.fields = { ...(item.fields || {}), date: false };
          renderPage();
          state().scheduleSave();
        });
        dateWrap.append(clearDate);
        row.append(dateWrap);
      }
      el.append(row);
    }
    return el;
  }

  function renderBullet(item, idx) {
    const li = h('li', { class: 'cv-bullet' });
    const holder = {};
    Object.defineProperty(holder, 'text', {
      get: () => item.bullets[idx] || '',
      set: (value) => {
        item.bullets[idx] = value;
      },
    });
    Object.defineProperty(holder, '__itemId', { value: item.id });
    Object.defineProperty(holder, '__idx', { value: idx });
    const text = ce(holder, 'text', {
      placeholder: '做了什么、怎么做、结果如何',
      className: 'cv-bullet-text',
      singleLine: false,
      onKey: (e, node) => {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          insertBulletAfter(item, idx);
        } else if (e.key === 'Backspace' && caretAtStart(node)) {
          if (!textContent(node)) {
            e.preventDefault();
            removeBulletAt(item, idx, true);
          } else if (idx > 0) {
            e.preventDefault();
            const merged = `${item.bullets[idx - 1]}${node.textContent}`;
            item.bullets[idx - 1] = merged;
            item.bullets.splice(idx, 1);
            renderPage();
            state().scheduleSave();
            focusSelector(`.cv-item[data-iid="${item.id}"] .cv-bullet:nth-child(${idx}) .cv-bullet-text`);
          }
        }
      },
    });
    text.style.whiteSpace = 'pre-wrap';

    const del = h('button', { class: 'cv-bullet-del', type: 'button', title: '删除这条描述' }, '×');
    del.addEventListener('click', () => removeBulletAt(item, idx, false));
    li.append(text, del);
    return li;
  }

  function textContent(node) {
    return (node.textContent || '').replace(/[\s\u00a0]/g, '');
  }

  function caretAtStart(node) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const probe = range.cloneRange();
    probe.selectNodeContents(node);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length === 0;
  }

  // ---------------- 结构操作 ----------------
  function findSection(id) {
    return state().data.sections.find((s) => s.id === id);
  }

  function addItem(sec) {
    const item = App.data.blankItem(sec.kind);
    sec.items.push(item);
    renderPage();
    state().scheduleSave();
    if (sec.kind === 'info') {
      focusSelector(`.cv-item[data-iid="${item.id}"] .cv-info-line`);
    } else if (sec.kind === 'timeline') {
      focusSelector(`.cv-item[data-iid="${item.id}"] .cv-item-title`);
    } else if (sec.kind === 'text') {
      focusSelector(`.cv-item[data-iid="${item.id}"] .cv-text`);
    } else {
      focusSelector(`.cv-item[data-iid="${item.id}"] .cv-tag-label, .cv-item[data-iid="${item.id}"] .cv-list-text`);
    }
  }

  function toggleSectionTitle(sec) {
    sec.hideTitle = !sec.hideTitle;
    renderPage();
    state().scheduleSave();
  }

  function toggleDots(item) {
    item.dots = item.dots === false;
    renderPage();
    state().scheduleSave();
  }

  function addBullet(sec, item) {
    item.bullets.push('');
    renderPage();
    state().scheduleSave();
    focusSelector(`.cv-item[data-iid="${item.id}"] .cv-bullet:last-child .cv-bullet-text`);
  }

  function insertBulletAfter(item, idx) {
    item.bullets.splice(idx + 1, 0, '');
    renderPage();
    state().scheduleSave();
    focusSelector(`.cv-item[data-iid="${item.id}"] .cv-bullet:nth-child(${idx + 2}) .cv-bullet-text`);
  }

  function removeBulletAt(item, idx, moveFocus) {
    item.bullets.splice(idx, 1);
    renderPage();
    state().scheduleSave();
    if (moveFocus) {
      const itemEl = document.querySelector(`.cv-item[data-iid="${item.id}"]`);
      const bullets = itemEl?.querySelectorAll('.cv-bullet') || [];
      if (bullets.length) {
        const target =
          idx > 0 ? bullets[Math.min(idx - 1, bullets.length - 1)] : bullets[0];
        focusEnd(target.querySelector('.cv-bullet-text'));
      } else {
        focusSelector(`.cv-item[data-iid="${item.id}"] .cv-item-title`);
      }
    }
  }

  function moveItem(sec, item, delta) {
    const idx = sec.items.indexOf(item);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= sec.items.length) return;
    sec.items.splice(idx, 1);
    sec.items.splice(next, 0, item);
    renderPage();
    renderOutline();
    state().scheduleSave();
    focusSelector(`.cv-item[data-iid="${item.id}"] .cv-item-title`, { atEnd: false, scroll: true });
  }

  function duplicateItem(sec, item) {
    const copy = U.deepClone(item);
    copy.id = uid('i');
    const idx = sec.items.indexOf(item);
    sec.items.splice(idx + 1, 0, copy);
    renderPage();
    renderOutline();
    state().scheduleSave();
  }

  function removeItem(sec, item) {
    // 基本信息是一行一个小模块，直接删掉，不弹确认
    if (sec.kind !== 'info') {
      const label = U.textOf(document.querySelector(`.cv-item[data-iid="${item.id}"]`)) || '这一条';
      if (!window.confirm(`删除「${label.slice(0, 40)}」？`)) return;
    }
    const idx = sec.items.indexOf(item);
    sec.items.splice(idx, 1);
    renderPage();
    renderOutline();
    state().scheduleSave();
  }

  function moveSection(sec, delta) {
    const sections = state().data.sections;
    const idx = sections.indexOf(sec);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= sections.length) return;
    sections.splice(idx, 1);
    sections.splice(next, 0, sec);
    renderPage();
    renderOutline();
    state().scheduleSave();
  }

  function removeSection(sec) {
    const ok = window.confirm(`删除「${sec.title}」整个板块？里面的内容也会一起删掉。`);
    if (!ok) return;
    const sections = state().data.sections;
    sections.splice(sections.indexOf(sec), 1);
    renderPage();
    renderOutline();
    state().scheduleSave();
    toast('板块已删除');
  }

  // ---------------- 贴图层 ----------------
  function findSticker(id) {
    return state().data.stickers.find((s) => s.id === id);
  }

  function renderStickers() {
    const page = pageEl();
    if (!page) return;
    const old = page.querySelector('.sticker-layer');
    if (old) old.remove();
    const layer = h('div', { class: 'sticker-layer' });
    for (const st of state().data.stickers) {
      layer.append(stickerNode(st));
    }
    page.prepend(layer);
    updateStickerBar();
  }

  function stickerNode(st) {
    const selected = state().selectedSticker === st.id;
    const el = h('div', {
      class: `sticker${selected ? ' is-selected' : ''}`,
      dataset: { stid: st.id },
      title: st.name,
    });
    el.style.left = `${st.x}mm`;
    el.style.top = `${st.y}mm`;
    el.style.width = `${st.w}mm`;
    el.style.opacity = String(st.opacity);
    el.style.transform = `rotate(${st.rot}deg)`;
    if (st.tintable) el.style.color = st.color || 'var(--accent)';

    if (st.svg) el.innerHTML = st.svg;
    else if (st.src) {
      const img = h('img', { src: st.src, alt: st.name, draggable: 'false' });
      el.append(img);
    }

    const resize = h('div', { class: 'sticker-handle', 'data-h': 'resize' });
    const rotate = h('div', { class: 'sticker-handle', 'data-h': 'rotate' });
    el.append(resize, rotate);
    el.addEventListener('pointerdown', onStickerPointerDown);
    return el;
  }

  function selectSticker(id) {
    state().selectedSticker = id || null;
    document.querySelectorAll('.sticker').forEach((node) => {
      node.classList.toggle('is-selected', node.dataset.stid === state().selectedSticker);
    });
    updateStickerBar();
  }

  let stickerDrag = null;

  function onStickerPointerDown(e) {
    const el = e.currentTarget;
    const st = findSticker(el.dataset.stid);
    if (!st) return;
    e.preventDefault();
    e.stopPropagation();
    selectSticker(st.id);

    const page = pageEl();
    const rect = page.getBoundingClientRect();
    const pxPerMm = rect.width / 210;
    const handle = e.target.closest('[data-h]');
    const mode = handle ? handle.dataset.h : 'move';
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const heightMm = el.offsetHeight / (96 / 25.4);
    const centerX = (st.x + st.w / 2) * pxPerMm;
    const centerY = (st.y + heightMm / 2) * pxPerMm;

    stickerDrag = {
      st,
      el,
      mode,
      pxPerMm,
      startX: st.x,
      startY: st.y,
      startW: st.w,
      startRot: st.rot,
      startPx: e.clientX,
      startPy: e.clientY,
      startDist: Math.hypot(offsetX - centerX, offsetY - centerY) || 1,
      startAngle: Math.atan2(offsetY - centerY, offsetX - centerX) * (180 / Math.PI),
    };
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* 某些合成事件没有真实指针，忽略 */
    }
    el.addEventListener('pointermove', onStickerPointerMove);
    el.addEventListener('pointerup', endStickerDrag);
    el.addEventListener('pointercancel', endStickerDrag);
  }

  function onStickerPointerMove(e) {
    const drag = stickerDrag;
    if (!drag) return;
    const { st } = drag;
    if (drag.mode === 'move') {
      st.x = drag.startX + (e.clientX - drag.startPx) / drag.pxPerMm;
      st.y = drag.startY + (e.clientY - drag.startPy) / drag.pxPerMm;
      const page = pageEl();
      const maxY = (page.offsetHeight / drag.pxPerMm) - 4;
      st.x = clamp(st.x, -st.w * 0.4, 210 - st.w * 0.6);
      st.y = clamp(st.y, -st.w * 0.4, maxY - st.w * 0.2);
    } else if (drag.mode === 'resize') {
      const page = pageEl();
      const rect = page.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const heightMm = drag.el.offsetHeight / (96 / 25.4);
      const centerX = (drag.startX + drag.startW / 2) * drag.pxPerMm;
      const centerY = (drag.startY + heightMm / 2) * drag.pxPerMm;
      const dist = Math.hypot(offsetX - centerX, offsetY - centerY) || 1;
      const nextW = clamp(drag.startW * (dist / drag.startDist), 4, 160);
      st.w = Math.round(nextW * 10) / 10;
    } else if (drag.mode === 'rotate') {
      const page = pageEl();
      const rect = page.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const heightMm = drag.el.offsetHeight / (96 / 25.4);
      const centerX = (drag.startX + drag.startW / 2) * drag.pxPerMm;
      const centerY = (drag.startY + heightMm / 2) * drag.pxPerMm;
      const angle = Math.atan2(offsetY - centerY, offsetX - centerX) * (180 / Math.PI);
      const delta = angle - drag.startAngle;
      // 吸附到 0 / 90 / 180 / 270 附近
      let next = drag.startRot + delta;
      const snapped = Math.round(next / 90) * 90;
      if (Math.abs(next - snapped) < 4) next = snapped;
      st.rot = Math.round(next);
    }
    drag.el.style.left = `${st.x}mm`;
    drag.el.style.top = `${st.y}mm`;
    drag.el.style.width = `${st.w}mm`;
    drag.el.style.transform = `rotate(${st.rot}deg)`;
    updateStickerBar();
  }

  function endStickerDrag(e) {
    const drag = stickerDrag;
    if (!drag) return;
    const { el } = drag;
    try {
      el.releasePointerCapture?.(e.pointerId);
    } catch {
      /* 忽略 */
    }
    el.removeEventListener('pointermove', onStickerPointerMove);
    el.removeEventListener('pointerup', endStickerDrag);
    el.removeEventListener('pointercancel', endStickerDrag);
    stickerDrag = null;
    state().scheduleSave();
    updateStickerBar();
  }

  function addSticker({ svg, src, name, tintable, color }) {
    const data = state().data;
    const st = {
      id: uid('st'),
      name: name || '贴图',
      x: 148 - (data.stickers.length % 3) * 14,
      y: 10 + (data.stickers.length % 4) * 14,
      w: 24,
      rot: 0,
      opacity: 1,
      svg: svg || '',
      src: src || '',
      tintable: Boolean(tintable),
      color: color || '',
      front: false,
    };
    data.stickers.push(st);
    renderStickers();
    selectSticker(st.id);
    state().scheduleSave();
    return st;
  }

  function removeSticker(id) {
    const stickers = state().data.stickers;
    const idx = stickers.findIndex((s) => s.id === id);
    if (idx < 0) return;
    stickers.splice(idx, 1);
    if (state().selectedSticker === id) state().selectedSticker = null;
    renderStickers();
    state().scheduleSave();
  }

  function duplicateSticker(id) {
    const st = findSticker(id);
    if (!st) return;
    const copy = U.deepClone(st);
    copy.id = uid('st');
    copy.x += 6;
    copy.y += 6;
    state().data.stickers.push(copy);
    renderStickers();
    selectSticker(copy.id);
    state().scheduleSave();
  }

  function updateStickerBar() {
    const existing = document.querySelector('.sticker-bar');
    const st = state().selectedSticker ? findSticker(state().selectedSticker) : null;
    const node = st ? document.querySelector(`.sticker[data-stid="${st.id}"]`) : null;
    if (!st || !node) {
      existing?.remove();
      return;
    }
    let bar = existing;
    if (!bar) {
      bar = h('div', { class: 'sticker-bar' });
      document.body.append(bar);
      bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    bar.innerHTML = '';
    const actions = [
      ['copy', '复制一份', () => duplicateSticker(st.id)],
      ['trash', '删除贴图', () => removeSticker(st.id), true],
      ['check', '完成', () => selectSticker(null)],
    ];
    for (const [name, title, fn, danger] of actions) {
      const btn = h('button', {
        class: `mini-icon${danger ? ' danger' : ''}`,
        type: 'button',
        title,
        'aria-label': title,
        html: icon(name, 13),
      });
      btn.addEventListener('click', fn);
      bar.append(btn);
    }
    const rect = node.getBoundingClientRect();
    const stage = document.getElementById('stage-scroll');
    const stageRect = stage ? stage.getBoundingClientRect() : { left: 8, right: window.innerWidth };
    const drawer = document.getElementById('drawer');
    const drawerOpen = drawer && drawer.classList.contains('is-open');
    const rightLimit = drawerOpen ? drawer.getBoundingClientRect().left - 10 : stageRect.right - 10;
    const half = bar.offsetWidth / 2 || 60;
    let center = rect.left + rect.width / 2;
    center = Math.min(center, rightLimit - half);
    center = Math.max(center, stageRect.left + 10 + half);
    bar.style.left = `${center}px`;
    bar.style.top = `${Math.max(8, rect.top - 38)}px`;
    bar.style.transform = 'translateX(-50%)';
  }

  // ---------------- 左侧板块列表 ----------------
  let dragState = null;

  function renderOutline() {
    const list = document.getElementById('outline-list');
    if (!list) return;
    list.innerHTML = '';
    const data = state().data;
    if (!data.sections.length) {
      list.append(h('p', { class: 'outline-tip' }, '还没有板块，点右上角的 ＋ 添加。'));
      return;
    }
    data.sections.forEach((sec) => {
      const row = h('div', {
        class: `outline-row${sec.visible ? '' : ' is-hidden'}${state().activeSection === sec.id ? ' is-active' : ''}`,
        dataset: { sid: sec.id },
        draggable: 'true',
      });
      row.append(h('span', { class: 'outline-grip', html: icon('grip', 13) }));
      if (data.theme.whales) {
        row.append(whaleEmoji(sec, 'outline-icon outline-whale'));
      } else {
        row.append(h('span', { class: 'outline-icon', html: icon(sec.icon, 12) }));
      }
      row.append(h('span', { class: 'outline-label', text: sec.title || '未命名板块' }));
      row.append(h('span', { class: 'outline-count', text: String(sec.items.length) }));

      const tools = h('div', { class: 'outline-tools' });
      tools.append(miniIcon(sec.visible ? 'eye' : 'eyeOff', () => toggleVisible(sec), sec.visible ? '隐藏' : '显示'));
      tools.append(miniIcon('up', () => moveSection(sec, -1), '上移'));
      tools.append(miniIcon('down', () => moveSection(sec, 1), '下移'));
      tools.append(miniIcon('trash', () => removeSection(sec), '删除', true));
      row.append(tools);

      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        setActiveSection(sec.id);
        if (!sec.visible) {
          toast('这个板块现在是隐藏的');
          return;
        }
        const target = document.querySelector(`.cv-sec[data-sid="${sec.id}"]`);
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });

      row.addEventListener('dragstart', (e) => {
        dragState = { sid: sec.id };
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', sec.id);
        } catch {
          /* 忽略 */
        }
      });
      row.addEventListener('dragend', () => {
        dragState = null;
        row.classList.remove('is-dragging');
        clearDropMarks();
      });
      row.addEventListener('dragover', (e) => {
        if (!dragState || dragState.sid === sec.id) return;
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        clearDropMarks();
        row.classList.add(after ? 'is-drop-after' : 'is-drop-before');
        dragState.target = sec.id;
        dragState.after = after;
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragState?.target) return;
        reorderSections(dragState.sid, dragState.target, dragState.after);
        dragState = null;
        clearDropMarks();
      });
      list.append(row);
    });
  }

  function clearDropMarks() {
    document.querySelectorAll('.outline-row').forEach((row) => {
      row.classList.remove('is-drop-before', 'is-drop-after');
    });
  }

  function reorderSections(fromId, toId, after) {
    if (!fromId || !toId || fromId === toId) return;
    const sections = state().data.sections;
    const from = sections.findIndex((s) => s.id === fromId);
    let to = sections.findIndex((s) => s.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = sections.splice(from, 1);
    to = sections.findIndex((s) => s.id === toId);
    sections.splice(after ? to + 1 : to, 0, moved);
    renderPage();
    renderOutline();
    state().scheduleSave();
  }

  function toggleVisible(sec) {
    sec.visible = !sec.visible;
    renderPage();
    renderOutline();
    state().scheduleSave();
  }

  function miniIcon(iconName, fn, title, danger) {
    const btn = h('button', {
      class: `mini-icon${danger ? ' danger' : ''}`,
      type: 'button',
      title,
      'aria-label': title,
      html: icon(iconName, 13),
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return btn;
  }

  function applyTypeVars(page = pageEl(), data = state().data) {
    if (!page || !data || !data.theme.type) return;
    const t = data.theme.type;
    const font = (f) => (f === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)');
    page.style.setProperty('--font-info', font(t.info.font));
    page.style.setProperty('--font-body', font(t.body.font));
    page.style.setProperty('--font-sec', font(t.heading.font));
    page.style.setProperty('--fs-info', `${t.info.size}px`);
    page.style.setProperty('--weight-info', String(t.info.weight || 400));
    page.style.setProperty('--info-color', t.info.color);
    page.style.setProperty('--fs-body', `${t.body.size}px`);
    page.style.setProperty('--fs-item', `${t.body.size}px`);
    page.style.setProperty('--fs-small', `${Math.max(8.5, t.body.size - 1.5)}px`);
    page.style.setProperty('--body-color', t.body.color);
    page.style.setProperty('--fs-sec', `${t.heading.size}px`);
    page.style.setProperty('--sec-color', t.heading.color || 'var(--accent)');
  }

  // ---------------- 左侧 arXiv 风格标记 ----------------
  function renderStamps() {
    const page = pageEl();
    if (!page) return;
    page.querySelector('.page-stamps')?.remove();
    const stamp = state().data.theme.stamp;
    if (!stamp || !stamp.enabled || !Array.isArray(stamp.columns) || !stamp.columns.length) return;

    const layer = h('div', { class: 'page-stamps' });
    const size = stamp.size || 12;
    const columns = stamp.columns.slice(0, 3);
    // 旋转后每个标记的横向宽度 ≈ 行高；在 24mm 左边距里从 3mm 开始排
    const lineHeightMm = (size * 1.15 * 25.4) / 96;
    columns.forEach((col, idx) => {
      const span = h('span', {
        class: 'page-stamp',
        contenteditable: PLAINTEXT_OK ? 'plaintext-only' : 'true',
        spellcheck: 'false',
        title: '点击编辑左侧标记',
        'data-ph': App.data.DEFAULT_STAMP,
      });
      span.textContent = col.text || '';
      span.style.left = `${3 + lineHeightMm * (idx + 1) + idx * 0.9}mm`;
      span.style.fontSize = `${size}px`;
      span.addEventListener('input', () => {
        col.text = span.innerText.replace(/\u00a0/g, ' ').replace(/\s*\n+\s*/g, ' ');
        centerStamp(span);
        state().scheduleSave();
      });
      span.addEventListener('blur', () => {
        normalizeEditable(span);
        if (!col.text) col.text = '';
      });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          span.blur();
        }
      });
      layer.append(span);
    });
    page.append(layer);
    for (const span of layer.children) centerStamp(span);
  }

  function centerStamp(span) {
    // 旋转后文字从锚点向上延伸，让整条文字以 A4 页面中线为中心
    const widthMm = (span.offsetWidth * 25.4) / 96;
    const heightMm = (span.offsetHeight * 25.4) / 96;
    span.style.top = `${148.5 + widthMm / 2 - heightMm}mm`;
  }

  // ---------------- 整页渲染 ----------------
  function renderPage() {
    const data = state().data;
    const page = pageEl();
    if (!page) return;
    focus.node = null;
    focus.obj = null;
    focus.field = null;

    const scroll = scrollEl();
    const keepScroll = scroll ? scroll.scrollTop : 0;

    page.innerHTML = '';
    page.dataset.font = data.theme.font;
    page.dataset.heading = data.theme.heading;
    page.dataset.density = data.theme.density;
    page.classList.toggle('has-whales', Boolean(data.theme.whales));
    page.style.setProperty('--accent', data.theme.accent);
    page.style.background = data.theme.background || '';
    applyTypeVars(page, data);
    page.classList.toggle('show-guide', Boolean(data.view.guide));

    const layer = h('div', { class: 'sticker-layer' });
    for (const st of data.stickers) layer.append(stickerNode(st));
    page.append(layer);

    const body = h('div', { class: 'page-body' });

    const visible = data.sections.filter((sec) => sec.visible);
    visible.forEach((sec) => body.append(renderSection(sec)));
    if (!visible.length) {
      body.append(
        h('div', { class: 'cv-empty', style: 'padding-top:20mm;text-align:center' }, '左侧所有板块都被隐藏了，点眼睛图标可以重新显示。'),
      );
    }
    page.append(body);
    renderStamps();

    if (scroll) scroll.scrollTop = keepScroll;
    updateStickerBar();
    App.ui?.updateScale?.();
    App.ui?.syncOutlineActive?.();
  }

  App.render = {
    ce,
    page: renderPage,
    outline: renderOutline,
    stickers: renderStickers,
    selectSticker,
    addSticker,
    removeSticker,
    duplicateSticker,
    updateStickerBar,
    addItem,
    addBullet,
    type: applyTypeVars,
    stamps: renderStamps,
    findSticker,
    setActiveSection,
    focusSelector,
    pageEl,
  };
})();
