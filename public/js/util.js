/* 通用小工具：DOM 构建、图标、提示、SVG 清洗等 */
(function () {
  const App = (window.App = window.App || {});

  const ICONS = {
    grip: '<circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none"/>',
    eye: '<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.9"/>',
    eyeOff: '<path d="M10.6 5.8A9 9 0 0 1 12 5.6c6 0 9.5 6.4 9.5 6.4a16.5 16.5 0 0 1-3.3 4.2"/><path d="M6.7 6.9A16.7 16.7 0 0 0 2.5 12S6 18.4 12 18.4a9.4 9.4 0 0 0 4.2-1"/><path d="m3.4 3.4 17.2 17.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    trash: '<path d="M3.8 6.6h16.4"/><path d="M8.6 6.6V4.4h6.8v2.2"/><path d="M6.2 6.6 7.1 20h9.8l.9-13.4"/><path d="M10 10.4v5.8M14 10.4v5.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2"/><path d="M15.6 8.4V5.6a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.8"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    sparkle: '<path d="m12 2.8 2.3 5.6 5.6 2.3-5.6 2.3L12 18.6l-2.3-5.6L4.1 10.7l5.6-2.3Z"/><path d="M18.6 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    upload: '<path d="M12 16.2V4.2"/><path d="m7 9.2 5-5 5 5"/><path d="M4 15.4v3.2A1.8 1.8 0 0 0 5.8 20.4h12.4a1.8 1.8 0 0 0 1.8-1.8v-3.2"/>',
    download: '<path d="M12 4.2v12"/><path d="m7 11.2 5 5 5-5"/><path d="M4 15.4v3.2A1.8 1.8 0 0 0 5.8 20.4h12.4a1.8 1.8 0 0 0 1.8-1.8v-3.2"/>',
    check: '<path d="m4.8 12.4 4.8 4.8 9.6-10.4"/>',
    refresh: '<path d="M19.8 12a7.8 7.8 0 1 1-2.3-5.5"/><path d="M19.8 4.4V10h-5.6"/>',
    image: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.2"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="m4.4 17.4 4.8-4.8 3.8 3.8 2.6-2.6 4.4 4.4"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.4a2.1 2.1 0 0 0 0-4.2h-.7a1.6 1.6 0 0 1 0-3.2H16a5 5 0 0 0 5-5c0-3.1-4-5.6-9-5.6Z"/><circle cx="8.2" cy="9.2" r="1"/><circle cx="12" cy="7.4" r="1"/><circle cx="7.2" cy="13.4" r="1"/>',
    briefcase: '<rect x="3" y="7.4" width="18" height="12.6" rx="2.2"/><path d="M8.6 7.4V5.6a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.8"/><path d="M3 12.6h18"/>',
    folder: '<path d="M3.6 6.4a2 2 0 0 1 2-2h3.9l2 2.4h7a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2Z"/>',
    graduation: '<path d="m12 4 8.8 4.4L12 12.8 3.2 8.4Z"/><path d="M6.6 11.2v4.6c0 1.5 2.4 2.8 5.4 2.8s5.4-1.3 5.4-2.8v-4.6"/>',
    user: '<circle cx="12" cy="8.4" r="3.8"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/>',
    code: '<path d="m8.8 6.8-5 5.2 5 5.2"/><path d="m15.2 6.8 5 5.2-5 5.2"/>',
    award: '<circle cx="12" cy="9.2" r="5.2"/><path d="m8.6 13.6-1.4 7 4.8-2.6 4.8 2.6-1.4-7"/>',
    link: '<path d="M10.4 13.6a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M13.6 10.4a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
    phone: '<path d="M6.6 3.8h2.8l1.6 4-2 1.3a11.6 11.6 0 0 0 5.9 5.9l1.3-2 4 1.6v2.8a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 6a2 2 0 0 1 2-2.2Z"/>',
    mail: '<rect x="3" y="5.6" width="18" height="12.8" rx="2.2"/><path d="m3.8 6.8 8.2 6 8.2-6"/>',
    pin: '<path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    chevronDown: '<path d="m6 9.2 6 6 6-6"/>',
    sliders: '<path d="M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
    type: '<path d="M5 5.4h14"/><path d="M12 5.4V18.6"/><path d="M8.6 18.6h6.8"/>',
    rotate: '<path d="M19.8 12a7.8 7.8 0 1 1-2.3-5.5"/><path d="M19.8 4.4V10h-5.6"/>',
    layers: '<path d="m12 3.6 8.4 4.4L12 12.4 3.6 8Z"/><path d="m3.6 12.2 8.4 4.4 8.4-4.4"/><path d="m3.6 16 8.4 4.4 8.4-4.4"/>',
    wand: '<path d="M4 20 15.2 8.8"/><path d="m17.6 5.2.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9Z"/><path d="M6.6 4.2 7.3 6l1.8.7-1.8.7-.7 1.8-.7-1.8L4.1 6.7 5.9 6Z"/>',
    text: '<path d="M5 6.6h14"/><path d="M5 12h9.6"/><path d="M5 17.4h12"/>',
    list: '<path d="M9 6.4h11M9 12h11M9 17.6h11"/><circle cx="4.4" cy="6.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.4" cy="17.6" r="1.3" fill="currentColor" stroke="none"/>',
    listOff: '<path d="M9 6.4h11M9 12h11M9 17.6h11"/><path d="M3.2 6.4h2.4M3.2 12h2.4M3.2 17.6h2.4"/>',
  };

  function icon(name, size = 16) {
    const body = ICONS[name] || ICONS.sparkle;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  /** 轻量 DOM 构建器：h('div', {class:'x', onclick: fn}, child, 'text') */
  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'props') Object.assign(node, value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  let toastTimer = 0;
  function toast(message, options = {}) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', Boolean(options.error));
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), options.duration || 2600);
  }

  function uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function debounce(fn, ms) {
    let timer = 0;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = (...args) => {
      clearTimeout(timer);
      fn(...args);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
  }

  function deepClone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeEditable(node) {
    if (!node) return;
    const text = node.textContent || '';
    if (!text.replace(/[\s\u00a0]/g, '')) {
      node.innerHTML = '';
      return;
    }
    // 去掉尾部多余的 <br>
    while (node.lastChild && node.lastChild.nodeName === 'BR') node.lastChild.remove();
  }

  function focusEnd(node) {
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  }

  function formatTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const BANNED_SVG_TAGS = [
    'script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video',
    'image', 'use', 'style', 'animate', 'animateTransform', 'animateMotion', 'set',
  ];

  /** 把模型返回的 SVG 文本清洗成安全的 inline SVG 字符串；失败返回 null */
  function sanitizeSvg(input) {
    if (typeof input !== 'string') return null;
    let text = input.trim();
    text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    const start = text.indexOf('<svg');
    const end = text.lastIndexOf('</svg>');
    if (start < 0 || end < start) return null;
    text = text.slice(start, end + 6);
    if (text.length > 24000) return null;

    let doc;
    try {
      doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    } catch {
      return null;
    }
    if (!doc || doc.querySelector('parsererror')) return null;
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;

    for (const selector of BANNED_SVG_TAGS) {
      for (const node of Array.from(svg.querySelectorAll(selector))) node.remove();
    }
    for (const node of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
      for (const attr of Array.from(node.attributes || [])) {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (name.startsWith('on')) node.removeAttribute(attr.name);
        if (
          (name === 'href' || name === 'xlink:href' || name === 'src') &&
          /^\s*(javascript|data:text\/html|https?:)/i.test(value)
        ) {
          node.removeAttribute(attr.name);
        }
        if (name === 'style' && /url\s*\(|expression|javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      }
    }
    if (!svg.getAttribute('viewBox')) {
      const width = parseFloat(svg.getAttribute('width')) || 100;
      const height = parseFloat(svg.getAttribute('height')) || 100;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    for (const attr of ['width', 'height']) {
      if (svg.hasAttribute(attr)) svg.removeAttribute(attr);
    }
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const out = svg.outerHTML;
    return out.length > 24000 ? null : out;
  }

  function isSvg(text) {
    return typeof text === 'string' && /^\s*<svg[\s>]/i.test(text.replace(/^```[a-zA-Z]*\s*/, ''));
  }

  function textOf(node) {
    return (node?.innerText || node?.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  App.util = {
    h, icon, toast, uid, clamp, debounce, deepClone, normalizeEditable, focusEnd,
    download, readFileAsDataURL, formatTime, sanitizeSvg, isSvg, textOf,
    ICONS,
  };
})();
