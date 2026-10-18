/* 默认数据、板块模板、主题预设、内置贴图 */
(function () {
  const App = (window.App = window.App || {});
  const { uid } = App.util;

  function item(fields) {
    return {
      id: uid('i'),
      title: '',
      meta: '',
      date: '',
      text: '',
      bullets: [],
      dots: true,
      fields: { title: true, date: true, meta: true },
      dateBelow: false,
      style: null,
      ...fields,
    };
  }

  function section(fields) {
    return {
      id: uid('s'),
      kind: 'timeline',
      title: '新板块',
      icon: 'folder',
      visible: true,
      items: [],
      ...fields,
    };
  }

  const DEFAULT_STAMP = 'arXiv:XXXX.XXXXXv1 [cs.SE] 18 Oct 2026';

  const DEFAULT_DATA = {
    version: 1,
    meta: {
      photo: '',
      showPhoto: false,
    },
    theme: {
      presetId: 'blue',
      accent: '#1d4ed8',
      font: 'sans',
      heading: 'underline',
      density: 'normal',
      background: 'linear-gradient(180deg, #f4f8ff 0, #ffffff 120mm)',
      whales: true,
      type: {
        info: { font: 'sans', size: 12, weight: 400, color: '#23272e' },
        body: { font: 'sans', size: 12.5, color: '#3f4652' },
        heading: { font: 'sans', size: 14.5, color: '' },
      },
      stamp: {
        enabled: true,
        size: 12,
        columns: [{ id: 'stamp-main', text: DEFAULT_STAMP }],
      },
    },
    view: { guide: true },
    stickers: [],
    sections: [
      section({
        kind: 'info',
        title: '基本信息',
        icon: 'user',
        items: [
          item({ text: '姓名：李 明' }),
          item({ text: '求职方向：后端开发工程师' }),
          item({ text: '电话：138-0000-0000' }),
          item({ text: '邮箱：liming@example.com' }),
        ],
      }),
      section({
        kind: 'text',
        title: '个人简介',
        icon: 'user',
        items: [
          item({
            text: '5 年后端开发经验，主要用 Go 和 Java 写高并发服务，做过日活百万级交易系统的重构。习惯把复杂问题拆小，也愿意写文档、带新人。',
          }),
        ],
      }),
      section({
        kind: 'timeline',
        title: '工作经历',
        icon: 'briefcase',
        items: [
          item({
            title: '星野科技',
            meta: '高级后端工程师 · 上海',
            date: '2022.03 – 至今',
            bullets: [
              '主导订单服务从单体拆分为 6 个微服务，核心接口 P99 从 480ms 降到 120ms',
              '设计基于 Kafka 的异步对账方案，日处理 300 万笔流水，人工核对量下降 80%',
            ],
          }),
          item({
            title: '云图信息',
            meta: '后端开发工程师 · 杭州',
            date: '2019.07 – 2022.02',
            bullets: [
              '参与 SaaS 多租户权限系统设计，支撑 2000+ 企业客户',
              '优化 MySQL 慢查询与索引，列表接口平均耗时下降 65%',
            ],
          }),
        ],
      }),
      section({
        kind: 'timeline',
        title: '项目经历',
        icon: 'folder',
        items: [
          item({
            title: '实时风控引擎',
            meta: '主要开发 · 上海',
            date: '2023.06 – 2024.01',
            bullets: [
              '基于「规则 + 特征」的双层架构，单机吞吐 8k QPS',
              '引入 Redis 布隆过滤器拦截重复请求，误杀率控制在 0.3% 以内',
            ],
          }),
          item({
            title: '开源项目 go-taskflow',
            meta: '作者 · 上海',
            date: '2023',
            bullets: ['轻量任务编排库，GitHub 1.2k star，被 3 家公司用于生产环境'],
          }),
        ],
      }),
      section({
        kind: 'timeline',
        title: '教育经历',
        icon: 'graduation',
        items: [
          item({
            title: '浙江大学',
            meta: '软件工程 · 硕士 · 杭州',
            date: '2016.09 – 2019.06',
          }),
        ],
      }),
      section({
        kind: 'tags',
        title: '专业技能',
        icon: 'code',
        items: [
          item({ title: '编程语言', text: 'Go / Java / Python / TypeScript' }),
          item({ title: '存储与中间件', text: 'MySQL、Redis、Kafka、Elasticsearch' }),
          item({ title: '工程能力', text: '微服务架构、性能调优、可观测性、CI/CD' }),
        ],
      }),
      section({
        kind: 'list',
        title: '证书荣誉',
        icon: 'award',
        items: [
          item({ title: '阿里云 ACP 认证', date: '2021' }),
          item({ title: '公司年度技术突破奖', date: '2023' }),
        ],
      }),
    ],
  };

  const TEMPLATES = [
    {
      key: 'experience',
      kind: 'timeline',
      title: '工作经历',
      icon: 'briefcase',
      desc: '公司、职位、时间、工作要点',
      sample: () =>
        item({
          title: '公司名称',
          meta: '职位名称 · 城市',
          date: '2023.01 – 至今',
          bullets: ['用一句话写清做了什么、怎么做的、结果如何（尽量带数字）'],
        }),
    },
    {
      key: 'project',
      kind: 'timeline',
      title: '项目经历',
      icon: 'folder',
      desc: '项目、角色、成果',
      sample: () =>
        item({
          title: '项目名称',
          meta: '担任角色 · 城市',
          date: '2023.06 – 2023.12',
          bullets: ['项目背景与目标', '你的关键动作与量化结果'],
        }),
    },
    {
      key: 'education',
      kind: 'timeline',
      title: '教育经历',
      icon: 'graduation',
      desc: '学校、专业、时间',
      sample: () => item({ title: '学校名称', meta: '专业 · 学历 · 城市', date: '2019.09 – 2023.06' }),
    },
    {
      key: 'info',
      kind: 'info',
      title: '基本信息',
      icon: 'user',
      desc: '姓名、职位、联系方式',
      sample: () => item({ text: '姓名：你的名字' }),
    },
    {
      key: 'summary',
      kind: 'text',
      title: '个人简介',
      icon: 'user',
      desc: '一段话概括你的优势',
      sample: () => item({ text: '用 2–3 句话说明你的年限、方向、擅长的事，以及最能说明能力的成果。' }),
    },
    {
      key: 'skills',
      kind: 'tags',
      title: '专业技能',
      icon: 'code',
      desc: '分类 + 关键词',
      sample: () => item({ title: '技能分类', text: '关键词 1 / 关键词 2 / 关键词 3' }),
    },
    {
      key: 'awards',
      kind: 'list',
      title: '证书荣誉',
      icon: 'award',
      desc: '奖项、证书、时间',
      sample: () => item({ title: '奖项或证书名称', date: '2023' }),
    },
    {
      key: 'custom',
      kind: 'timeline',
      title: '自定义板块',
      icon: 'folder',
      desc: '自由发挥，比如「作品集」',
      sample: () => item({ title: '标题', meta: '说明', date: '时间' }),
    },
  ];

  const PRESETS = [
    {
      id: 'plain',
      name: '极简白',
      accent: '#1f2937',
      font: 'sans',
      heading: 'underline',
      background: '#ffffff',
    },
    {
      id: 'blue',
      name: '商务蓝',
      accent: '#1d4ed8',
      font: 'sans',
      heading: 'underline',
      background: 'linear-gradient(180deg, #f4f8ff 0, #ffffff 120mm)',
    },
    {
      id: 'teal',
      name: '墨绿',
      accent: '#0f766e',
      font: 'sans',
      heading: 'bar',
      background: 'radial-gradient(circle at 8% 6%, #eef7f4 0, rgba(255, 255, 255, 0) 40%), #ffffff',
    },
    {
      id: 'paper',
      name: '暖纸',
      accent: '#9a3412',
      font: 'serif',
      heading: 'block',
      background:
        'radial-gradient(circle at 1px 1px, rgba(154, 52, 18, 0.07) 1px, rgba(255, 255, 255, 0) 0) 0 0 / 14px 14px, #fdfaf3',
    },
    {
      id: 'violet',
      name: '紫罗兰',
      accent: '#6d28d9',
      font: 'sans',
      heading: 'bar',
      background:
        'radial-gradient(60% 38% at 100% 0%, #f1eaff 0, rgba(255, 255, 255, 0) 70%), #ffffff',
    },
    {
      id: 'graphite',
      name: '石墨',
      accent: '#334155',
      font: 'sans',
      heading: 'plain',
      background:
        'linear-gradient(#f4f6f8 1px, rgba(255, 255, 255, 0) 1px) 0 0 / 100% 22mm, linear-gradient(90deg, #f4f6f8 1px, rgba(255, 255, 255, 0) 1px) 0 0 / 22mm 100%, #ffffff',
    },
    {
      id: 'navy',
      name: '藏青',
      accent: '#1e3a8a',
      font: 'sans',
      heading: 'underline',
      background: 'linear-gradient(135deg, #eef2fb 0 62mm, #ffffff 62mm)',
    },
    {
      id: 'cinnabar',
      name: '朱砂',
      accent: '#b91c1c',
      font: 'serif',
      heading: 'underline',
      background:
        'radial-gradient(circle at 100% 100%, #fdf0ed 0, rgba(255, 255, 255, 0) 48%), #ffffff',
    },
    {
      id: 'sky',
      name: '天青',
      accent: '#0e7490',
      font: 'sans',
      heading: 'plain',
      background: 'linear-gradient(180deg, #f1fbfd 0, #ffffff 90mm)',
    },
    {
      id: 'stone',
      name: '素灰',
      accent: '#4b5563',
      font: 'sans',
      heading: 'bar',
      background: 'linear-gradient(180deg, #eceef0 0, #eceef0 7mm, #ffffff 7mm)',
    },
  ];

  const STICKERS = [
    {
      id: 'sparkle',
      name: '闪光',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10 58 42 90 50 58 58 50 90 42 58 10 50 42 42Z" fill="currentColor"/></svg>',
      tintable: true,
    },
    {
      id: 'star',
      name: '星星',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="m50 12 11.4 24.8 27.1 3.3-20 18.6 5.2 26.9L50 72.8 26.3 85.6l5.2-26.9-20-18.6 27.1-3.3Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>',
      tintable: true,
    },
    {
      id: 'leaf',
      name: '叶子',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M22 78C22 44 44 22 78 22c0 34-22 56-56 56Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M31 69 71 29" stroke="currentColor" stroke-width="4"/></svg>',
      tintable: true,
    },
    {
      id: 'wave',
      name: '波纹',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 38c10-13 20 13 30 0s20 13 30 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M10 60c10-13 20 13 30 0s20 13 30 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
      tintable: true,
    },
    {
      id: 'dots',
      name: '点阵',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="currentColor"><circle cx="26" cy="26" r="4"/><circle cx="50" cy="26" r="4"/><circle cx="74" cy="26" r="4"/><circle cx="26" cy="50" r="4"/><circle cx="50" cy="50" r="4"/><circle cx="74" cy="50" r="4"/><circle cx="26" cy="74" r="4"/><circle cx="50" cy="74" r="4"/><circle cx="74" cy="74" r="4"/></g></svg>',
      tintable: true,
    },
    {
      id: 'brackets',
      name: '角括',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M38 16H22v68h16" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M62 16h16v68H62" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>',
      tintable: true,
    },
    {
      id: 'circle',
      name: '圆环',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="4"/></svg>',
      tintable: true,
    },
    {
      id: 'asterisk',
      name: '星芒',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M50 16v68"/><path d="M22 33 78 67"/><path d="M78 33 22 67"/></g></svg>',
      tintable: true,
    },
    {
      id: 'bookmark',
      name: '书签',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M32 12h36v76L50 68 32 88Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>',
      tintable: true,
    },
    {
      id: 'arrow',
      name: '手绘箭头',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M16 78c18-6 40-18 56-44" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="m59 30 15 1 1 15" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      tintable: true,
    },
    {
      id: 'flower',
      name: '小花',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="currentColor" opacity=".85"><circle cx="50" cy="30" r="12"/><circle cx="70" cy="45" r="12"/><circle cx="62" cy="68" r="12"/><circle cx="38" cy="68" r="12"/><circle cx="30" cy="45" r="12"/></g><circle cx="50" cy="50" r="8" fill="#ffffff"/></svg>',
      tintable: true,
    },
    {
      id: 'coffee',
      name: '咖啡',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M26 34h44v24a22 22 0 0 1-44 0Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M70 40h7a10 10 0 0 1 0 20h-7" fill="none" stroke="currentColor" stroke-width="5"/><path d="M22 88h56" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
      tintable: true,
    },
  ];

  /** 把任意来源的数据补齐成当前结构，避免旧数据炸掉 */
  function normalize(raw) {
    const base = App.util.deepClone(DEFAULT_DATA);
    if (!raw || typeof raw !== 'object') return base;

    const data = { ...base, ...raw };
    const legacyMeta = (raw && raw.meta) || {};
    data.meta = {
      photo: typeof legacyMeta.photo === 'string' ? legacyMeta.photo : '',
      showPhoto: Boolean(legacyMeta.showPhoto),
    };

    data.theme = { ...base.theme, ...(raw.theme || {}) };
    if (!/^#[0-9a-f]{3,8}$/i.test(data.theme.accent || '')) data.theme.accent = '#1d4ed8';
    if (!['sans', 'serif'].includes(data.theme.font)) data.theme.font = 'sans';
    if (!['plain', 'underline', 'bar', 'block'].includes(data.theme.heading)) data.theme.heading = 'underline';
    if (!['normal', 'compact'].includes(data.theme.density)) data.theme.density = 'normal';
    data.theme.background = typeof data.theme.background === 'string' ? data.theme.background : '';
    data.theme.presetId = typeof data.theme.presetId === 'string' ? data.theme.presetId : '';
    if (typeof data.theme.whales !== 'boolean') data.theme.whales = true;

    const rawType = (raw.theme && raw.theme.type) || {};
    const legacyFont = data.theme.font === 'serif' ? 'serif' : 'sans';
    const pickFont = (v) => (v === 'serif' ? 'serif' : 'sans');
    const num = (v, lo, hi, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    };
    const colorOr = (v, fallback) => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? String(v) : fallback);
    data.theme.type = {
      info: {
        font: pickFont(rawType.info && rawType.info.font ? rawType.info.font : legacyFont),
        size: num(
          (rawType.info && (rawType.info.size || rawType.info.textSize)) || 12,
          9,
          32,
          12,
        ),
        weight: rawType.info && Number(rawType.info.weight) >= 550 ? 650 : 400,
        color: colorOr(rawType.info && rawType.info.color, '#23272e'),
      },
      body: {
        font: pickFont(rawType.body && rawType.body.font ? rawType.body.font : legacyFont),
        size: num(rawType.body && rawType.body.size, 9, 20, 12.5),
        color: colorOr(rawType.body && rawType.body.color, '#3f4652'),
      },
      heading: {
        font: pickFont(rawType.heading && rawType.heading.font ? rawType.heading.font : legacyFont),
        size: num(rawType.heading && rawType.heading.size, 9, 28, 14.5),
        color: colorOr(rawType.heading && rawType.heading.color, ''),
      },
    };

    const stampSource = (raw.theme && raw.theme.stamp) || base.theme.stamp;
    const stampColumns = (Array.isArray(stampSource.columns) ? stampSource.columns : [])
      .filter((c) => c && typeof c === 'object')
      .slice(0, 3)
      .map((c) => ({ id: c.id || uid('stamp'), text: String(c.text == null ? '' : c.text) }));
    if (!stampColumns.length) stampColumns.push({ id: uid('stamp'), text: DEFAULT_STAMP });
    const stampSize = Number.parseFloat(stampSource.size);
    data.theme.stamp = {
      enabled: stampSource.enabled !== false,
      size: Number.isFinite(stampSize) ? Math.min(18, Math.max(9, stampSize)) : 12,
      columns: stampColumns,
    };

    data.view = { guide: true, ...(raw.view || {}) };

    data.stickers = Array.isArray(raw.stickers)
      ? raw.stickers
          .filter((s) => s && (s.svg || s.src))
          .map((s) => ({
            id: s.id || uid('st'),
            name: String(s.name || '贴图'),
            x: Number.isFinite(+s.x) ? +s.x : 150,
            y: Number.isFinite(+s.y) ? +s.y : 20,
            w: Number.isFinite(+s.w) ? +s.w : 24,
            rot: Number.isFinite(+s.rot) ? +s.rot : 0,
            opacity: Number.isFinite(+s.opacity) ? +s.opacity : 1,
            svg: s.svg ? App.util.sanitizeSvg(s.svg) || '' : '',
            src: typeof s.src === 'string' ? s.src : '',
            tintable: Boolean(s.tintable),
            color: /^#[0-9a-f]{3,8}$/i.test(s.color || '') ? s.color : '',
            front: Boolean(s.front),
          }))
          .filter((s) => s.svg || s.src)
      : [];

    const sourceSections =
      Array.isArray(raw.sections) && raw.sections.length ? raw.sections : base.sections;

    const styleOr = (rawStyle) => {
      if (!rawStyle || typeof rawStyle !== 'object') return null;
      const style = {};
      if (rawStyle.font === 'sans' || rawStyle.font === 'serif') style.font = rawStyle.font;
      if (rawStyle.size != null) style.size = num(rawStyle.size, 9, 32, 12);
      if (rawStyle.weight != null) style.weight = Number(rawStyle.weight) >= 550 ? 650 : 400;
      if (/^#[0-9a-f]{3,8}$/i.test(String(rawStyle.color || ''))) style.color = String(rawStyle.color);
      return Object.keys(style).length ? style : null;
    };

    const sections = sourceSections
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({
        id: s.id || uid('s'),
        kind: ['timeline', 'text', 'tags', 'list', 'info'].includes(s.kind) ? s.kind : 'timeline',
        title: String(s.title || '未命名板块'),
        icon: typeof s.icon === 'string' ? s.icon : 'folder',
        visible: s.visible !== false,
        items: (Array.isArray(s.items) ? s.items : [])
          .filter((i) => i && typeof i === 'object')
          .map((i) => ({
            id: i.id || uid('i'),
            title: String(i.title || ''),
            meta: String(i.meta || [i.sub, i.place].filter(Boolean).join(' · ')),
            date: String(i.date || ''),
            text: String(i.text || ''),
            bullets: Array.isArray(i.bullets) ? i.bullets.map((b) => String(b || '')) : [],
            dots: i.dots !== false,
            fields: {
              title: !(i.fields && i.fields.title === false),
              date: !(i.fields && i.fields.date === false),
              meta: !(i.fields && i.fields.meta === false),
            },
            dateBelow: Boolean(i.dateBelow),
            style: styleOr(i.style),
          })),
      }));

    // 旧版本把姓名/联系方式放在 meta 里，这里迁移成「基本信息」板块
    if (!sections.some((s) => s.kind === 'info')) {
      const legacyContacts = Array.isArray(legacyMeta.contacts) ? legacyMeta.contacts : [];
      const legacyName = String(legacyMeta.name || '');
      const legacyTitle = String(legacyMeta.title || '');
      if (legacyName || legacyTitle || legacyContacts.length) {
        sections.unshift({
          id: uid('s'),
          kind: 'info',
          title: '基本信息',
          icon: 'user',
          visible: true,
          items: [
            item({
              title: legacyName,
              meta: legacyTitle,
              text: legacyContacts
                .map((c) => (c && typeof c === 'object' ? String(c.text || '') : String(c || '')))
                .filter(Boolean)
                .join(' · '),
            }),
          ],
        });
      }
    }

    for (const sec of sections) {
      if (sec.kind !== 'info') continue;
      const lines = [];
      for (const it of sec.items) {
        const titleMeta = [it.title, it.meta].filter((v) => String(v || '').trim());
        const textParts = it.text ? String(it.text).split('\n').filter((v) => String(v || '').trim()) : [];
        const legacy = titleMeta.length > 0 || textParts.length > 1;
        if (!legacy) {
          // 已经是一行一个小模块，保留这一行自己的样式
          lines.push(it);
          continue;
        }
        for (const text of [...titleMeta, ...textParts]) {
          const value = String(text).trim();
          if (!value) continue;
          lines.push({
            id: uid('i'),
            title: '',
            meta: '',
            date: '',
            text: value,
            bullets: [],
            dots: true,
            fields: { title: true, date: true, meta: true },
            dateBelow: false,
            style: it.style || null,
          });
        }
      }
      sec.items = lines.length ? lines : [item({ text: '' })];
    }

    data.sections = sections;
    return data;
  }

  App.data = {
    DEFAULT_DATA,
    TEMPLATES,
    PRESETS,
    STICKERS,
    DEFAULT_STAMP,
    normalize,
    item,
    section,
    blankItem(kind) {
      if (kind === 'text') return item({ text: '' });
      if (kind === 'tags') return item({ title: '', text: '' });
      if (kind === 'list') return item({ title: '', date: '' });
      if (kind === 'info') return item({ text: '' });
      return item({ title: '', meta: '', date: '', bullets: [''], dots: true });
    },
  };
})();
