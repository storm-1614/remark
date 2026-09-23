import { createServer } from 'node:http';
import { watchFile, unwatchFile } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function parseCliArgs(args) {
  const [command, file, ...flags] = args;
  if (!['import', 'present'].includes(command)) throw new Error('命令应为 import 或 present');
  if (!file || file.startsWith('--')) throw new Error('请提供 Markdown 文件路径');

  const options = { command, file, open: true, json: false, port: 0 };
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (flag === '--no-open') options.open = false;
    else if (flag === '--json') options.json = true;
    else if (flag === '--port') {
      const value = flags[++i];
      if (!/^\d+$/.test(value ?? '') || Number(value) > 65535) throw new Error('端口必须是 0–65535 的整数');
      options.port = Number(value);
    } else throw new Error(`未知参数：${flag}`);
  }
  return options;
}

function within(base, requested) {
  const fullPath = resolve(base, requested);
  return fullPath === base || fullPath.startsWith(base + sep) ? fullPath : null;
}

export async function resolveAssetPath(deckDir, assetPath) {
  if (!assetPath || assetPath.includes('\0') || assetPath.includes('\\')) return null;
  const root = await realpath(deckDir);
  const candidate = within(root, assetPath);
  if (!candidate) return null;
  try {
    const actual = await realpath(candidate);
    return within(root, actual);
  } catch {
    return null;
  }
}

function respond(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(body);
}

export async function createPreviewServer({ file, distDir, token, port = 0, watch = false }) {
  const deckDir = await realpath(resolve(file, '..'));
  const clients = new Set();
  const onFileChange = (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;
    for (const client of clients) client.write('event: change\ndata: reload\n\n');
  };

  const server = createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return respond(res, 405, 'Method Not Allowed');
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return respond(res, 400, 'Bad Request'); }
    const path = url.pathname;
    const protectedRoute = path === '/__deck.md' || path === '/__events' || path === '/__asset';
    if (protectedRoute && url.searchParams.get('token') !== token) return respond(res, 403, 'Forbidden');

    if (path === '/__events') {
      if (!watch) return respond(res, 404, 'Not Found');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      res.write(': connected\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }

    let target;
    if (path === '/__deck.md') target = file;
    else if (path === '/__asset') {
      const assetPath = url.searchParams.get('path');
      target = await resolveAssetPath(deckDir, assetPath);
      if (!target) return respond(res, 403, 'Forbidden');
    } else {
      let decoded;
      try { decoded = decodeURIComponent(path); }
      catch { return respond(res, 400, 'Bad Request'); }
      if (decoded.includes('\0') || decoded.includes('\\')) return respond(res, 400, 'Bad Request');
      const subpath = decoded.slice(1) || 'index.html';
      target = within(distDir, subpath);
      if (!target) return respond(res, 403, 'Forbidden');
    }

    try {
      const info = await stat(target);
      if (!info.isFile()) return respond(res, 404, 'Not Found');
      const body = req.method === 'HEAD' ? '' : await readFile(target);
      const type = path === '/__deck.md' ? 'text/markdown; charset=utf-8' : MIME[extname(target).toLowerCase()] || 'application/octet-stream';
      return respond(res, 200, body, type);
    } catch {
      return respond(res, 404, 'Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  if (watch) watchFile(file, { interval: 500 }, onFileChange);
  return {
    server,
    port: server.address().port,
    close: () => {
      if (watch) unwatchFile(file, onFileChange);
      for (const client of clients) client.end();
      return new Promise(resolve => server.close(resolve));
    },
  };
}
