#!/usr/bin/env node
/**
 * 简历工作台 · 本地服务
 *  - 提供 public/ 下的静态页面
 *  - AI 直接复用本机 DeepSeek Harness 的登录态（读取 ~/.dsh/.credentials.yaml）
 *    调用 DeepSeek 的 Anthropic 兼容接口，模型 deepseek-flash，无需填 API Key
 *  - 读写 data/resume.json（自动备份）
 *
 * 纯 Node 内置模块，无第三方依赖。
 */
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const RESUME_PATH = path.join(DATA_DIR, 'resume.json');
const MAX_BODY = 16 * 1024 * 1024; // 16MB，够放大头像

// ---- AI 配置：默认全部复用 DSH ----
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const CREDENTIALS_PATH = path.join(DSH_HOME, '.credentials.yaml');

const AI = {
  baseUrl: (process.env.AI_BASE_URL || 'https://api.deepseek.com/anthropic').replace(/\/+$/, ''),
  model: process.env.AI_MODEL || 'deepseek-flash',
  // 可选：如果你自己配了 DeepSeek API Key（同一个 DeepSeek，不是别家），可用环境变量覆盖登录态
  apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function log(...args) {
  console.log('[简历工作台]', ...args);
}

function trim(text, n = 300) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, '请求内容太大了（超过 16MB）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** 从 DSH 的 credentials.yaml 里取出 deepseek-account-platform 的登录 token。 */
async function readDshToken() {
  let text;
  try {
    text = await readFile(CREDENTIALS_PATH, 'utf8');
  } catch {
    return null;
  }
  // 兼容 Windows 的 CRLF 换行
  text = text.replace(/\r\n?/g, '\n');
  // 文件结构是固定缩进的 YAML：定位 deepseek-account-platform/default 记录里的 token 字段
  const blockMatch = text.match(/\n {2}deepseek-account-platform\/default:\n([\s\S]*?)(?=\n {2}[^\s]|\s*$)/);
  const scope = blockMatch ? blockMatch[1] : text;
  const tokenMatch = scope.match(/^\s+token:\s*(\S+)\s*$/m);
  if (tokenMatch) return tokenMatch[1];
  const anyToken = text.match(/^\s+token:\s*(\S+)\s*$/m);
  return anyToken ? anyToken[1] : null;
}

async function aiStatus() {
  if (AI.apiKey) {
    return { ok: true, source: 'api-key', model: AI.model, label: 'DeepSeek API Key（环境变量）' };
  }
  const token = await readDshToken();
  return {
    ok: Boolean(token),
    source: 'dsh-login',
    model: AI.model,
    label: token ? 'DSH 登录态 · DeepSeek' : '未检测到 DSH 登录态',
    detail: token ? '' : `没有找到 ${CREDENTIALS_PATH} 里的登录 token，请先打开 DeepSeek Harness 登录。`,
  };
}

/** 调 DeepSeek 的 Anthropic 兼容接口（Messages API）。 */
async function callAI({ system, messages, maxTokens = 2048, temperature = 0.7 }) {
  const token = AI.apiKey ? '' : await readDshToken();
  if (!AI.apiKey && !token) {
    throw new HttpError(
      401,
      '没有检测到 DeepSeek 登录态。请先打开 DeepSeek Harness 登录，然后回来重试。',
      'NO_TOKEN',
    );
  }
  if (!Array.isArray(messages) || !messages.length) {
    throw new HttpError(400, '缺少 messages 参数');
  }

  const body = {
    model: AI.model,
    max_tokens: Math.max(64, Math.min(Math.round(maxTokens) || 2048, 8192)),
    messages: messages
      .filter((m) => m && m.content)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
  };
  if (system) body.system = String(system);
  if (typeof temperature === 'number') body.temperature = Math.min(1, Math.max(0, temperature));
  // 简历里的这类小任务不需要长思考：关掉后响应快一个数量级，也不会把额度耗在思考上
  if (!process.env.AI_THINKING) body.thinking = { type: 'disabled' };

  const headers = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (AI.apiKey) {
    headers['x-api-key'] = AI.apiKey;
    headers.authorization = `Bearer ${AI.apiKey}`;
  } else {
    headers['x-dsh-auth-token'] = token;
  }

  let resp;
  try {
    resp = await fetch(`${AI.baseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
  } catch (err) {
    const hint =
      err?.name === 'TimeoutError'
        ? '请求超时（180 秒），模型可能太慢或网络不通。'
        : '连不上 DeepSeek 接口，检查网络或代理设置。';
    throw new HttpError(502, `${hint}（${err?.message || err}）`, 'NETWORK');
  }

  const raw = await resp.text();
  if (!resp.ok) {
    let msg = trim(raw, 400);
    try {
      msg = JSON.parse(raw)?.error?.message || msg;
    } catch {
      /* 保留原文 */
    }
    if (resp.status === 401) {
      throw new HttpError(
        401,
        'DeepSeek 登录态失效了。打开 DeepSeek Harness 重新登录一下，再回来点重试。',
        'TOKEN_INVALID',
      );
    }
    if (resp.status === 402) {
      throw new HttpError(402, 'DeepSeek 账号额度或用完了，去 platform.deepseek.com 看看。', 'QUOTA');
    }
    throw new HttpError(502, `DeepSeek 接口返回 ${resp.status}：${msg}`, 'UPSTREAM');
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HttpError(502, `DeepSeek 返回的不是 JSON：${trim(raw, 200)}`, 'BAD_JSON');
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const thinking = blocks
    .filter((b) => b && b.type === 'thinking')
    .map((b) => b.thinking)
    .join('')
    .trim();
  if (!text && !thinking) throw new HttpError(502, 'DeepSeek 没有返回内容，换个说法再试。', 'EMPTY');
  return {
    text: text || thinking,
    model: json.model || AI.model,
    usage: json.usage || null,
    stopped: json.stop_reason || null,
  };
}

async function handleApi(req, res, url) {
  const action = url.pathname.replace(/^\/api\//, '');

  if (action === 'ai-status' && req.method === 'GET') {
    return sendJson(res, 200, await aiStatus());
  }

  if (action === 'ai' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await callAI(body);
    return sendJson(res, 200, result);
  }

  if (action === 'resume' && req.method === 'GET') {
    try {
      const data = JSON.parse(await readFile(RESUME_PATH, 'utf8'));
      return sendJson(res, 200, { ok: true, data });
    } catch {
      return sendJson(res, 200, { ok: true, data: null });
    }
  }

  if (action === 'resume' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      throw new HttpError(400, '缺少要保存的数据');
    }
    await writeFile(RESUME_PATH, `${JSON.stringify(body.data, null, 2)}\n`, 'utf8');
    return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }

  throw new HttpError(404, `未知接口：${action}`);
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 找不到这个文件');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url);
    } else {
      res.writeHead(405).end('method not allowed');
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('[api]', err);
    if (!res.headersSent) {
      sendJson(res, status, { error: err?.message || '服务端错误', code: err?.code || '' });
    } else {
      res.end();
    }
  }
});

await mkdir(DATA_DIR, { recursive: true });

/** 跨平台打开浏览器：macOS / Windows / Linux */
function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  try {
    if (process.platform === 'darwin') {
      execFile('open', [url], { windowsHide: true }, () => {});
    } else if (process.platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
    } else {
      execFile('xdg-open', [url], { windowsHide: true }, () => {});
    }
  } catch {
    /* 打不开浏览器就算了，手动点地址栏 */
  }
}

const BASE_PORT = Number(process.env.PORT || 7788);
const MAX_TRIES = 20;

function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_TRIES) {
      listen(port + 1, attempt + 1);
    } else {
      console.error('启动失败：', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const address = `http://127.0.0.1:${port}`;
    const status = AI.apiKey ? 'DeepSeek API Key' : '复用 DSH 登录态';
    console.log('');
    console.log('  简历工作台已启动');
    console.log(`  打开： ${address}`);
    console.log(`  AI：   ${AI.model} · ${status}`);
    console.log(`  数据： ${DATA_DIR}`);
    console.log('  关闭窗口或按 Ctrl+C 停止服务');
    console.log('');
    openBrowser(address);
  });
}

listen(BASE_PORT);
