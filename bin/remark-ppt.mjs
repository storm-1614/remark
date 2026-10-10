#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { createPreviewServer, parseCliArgs } from './cli-core.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `用法：
  remark-ppt import  文件.md [--no-open] [--json] [--port 端口]
  remark-ppt preview 文件.md [--no-open] [--json] [--port 端口]
  remark-ppt present 文件.md [--no-open] [--json] [--port 端口]

import  在编辑器中打开 Markdown；网页中的修改不会写回源文件。
preview 只读预览本地 Markdown；在 Vim 中保存后自动刷新。
present 直接放映，并在源文件保存后自动刷新。
--no-open 不自动打开浏览器；--json 只向标准输出写入启动信息。
默认端口为 5175；--port 0 可由系统选择空闲端口。按 Ctrl+C 停止服务。`;

function openBrowser(url) {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', (error) => console.error(`无法自动打开浏览器：${error.message}`));
  child.unref();
}

async function main() {
  if (process.argv.slice(2).some((arg) => ['--help', '-h'].includes(arg))) {
    console.log(usage);
    return;
  }

  const options = parseCliArgs(process.argv.slice(2));
  const file = resolve(process.cwd(), options.file);
  if (!['.md', '.markdown'].includes(extname(file).toLowerCase())) throw new Error('请输入 .md 或 .markdown 文件');
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Markdown 路径不是文件');
  new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file));

  await build({ root: projectRoot, configFile: false, logLevel: 'silent' });

  const token = randomBytes(16).toString('hex');
  const preview = await createPreviewServer({
    file,
    distDir: resolve(projectRoot, 'dist'),
    token,
    port: options.port,
    watch: options.command === 'preview' || options.command === 'present',
  });
  const url = new URL(`http://127.0.0.1:${preview.port}/`);
  url.searchParams.set('cli', '1');
  url.searchParams.set('mode', options.command);
  url.searchParams.set('token', token);
  url.searchParams.set('name', basename(file));

  if (options.json) console.log(JSON.stringify({ version: 1, url: url.href, mode: options.command, file }));
  else console.log(`已启动：${url.href}\n按 Ctrl+C 停止服务。`);
  if (options.open) openBrowser(url.href);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try { await preview.close(); }
    catch (error) {
      console.error(`停止服务失败：${error.message}`);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error(error.code === 'EADDRINUSE'
    ? 'remark-ppt：端口已被占用，请先停止原有预览服务，或使用 --port 指定其他端口。'
    : `remark-ppt：${error.message}`);
  process.exitCode = 1;
});
