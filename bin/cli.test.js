import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewServer, parseCliArgs, resolveAssetPath } from './cli-core.mjs';

test('解析可供 NeoVim 调用的放映参数', () => {
  assert.deepEqual(
    parseCliArgs(['present', '讲稿.md', '--no-open', '--json', '--port', '0']),
    { command: 'present', file: '讲稿.md', open: false, json: true, port: 0 },
  );
});

test('导入命令默认打开浏览器并固定使用 5175 端口', () => {
  assert.deepEqual(
    parseCliArgs(['import', 'slides.md']),
    { command: 'import', file: 'slides.md', open: true, json: false, port: 5175 },
  );
});

test('预览命令接受本地 Markdown 文件并保留可选参数', () => {
  assert.deepEqual(
    parseCliArgs(['preview', 'slides.md', '--no-open', '--json']),
    { command: 'preview', file: 'slides.md', open: false, json: true, port: 5175 },
  );
});

test('缺少文件或端口不合法时拒绝执行', () => {
  assert.throws(() => parseCliArgs(['present']), /Markdown 文件/);
  assert.throws(() => parseCliArgs(['present', 'slides.md', '--port', 'nope']), /端口/);
  assert.throws(() => parseCliArgs(['present', 'slides.md', '--unknown']), /未知参数/);
});

test('资源路径只允许访问讲稿目录内的文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'remark-ppt-cli-'));
  const deckDir = join(root, 'deck');
  await mkdir(join(deckDir, 'images'), { recursive: true });
  await writeFile(join(deckDir, 'slides.md'), '# 测试');
  await writeFile(join(deckDir, 'images', '图 1.svg'), '<svg/>');
  await writeFile(join(root, 'secret.txt'), 'secret');
  await symlink(join(root, 'secret.txt'), join(deckDir, 'images', 'outside.txt'));
  try {
    assert.equal(await resolveAssetPath(deckDir, 'images/图 1.svg'), join(deckDir, 'images', '图 1.svg'));
    assert.equal(await resolveAssetPath(deckDir, '../secret.txt'), null);
    assert.equal(await resolveAssetPath(deckDir, 'images/outside.txt'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('本地文件保存后向预览页面推送更新，且读取到新内容', async () => {
  const root = await mkdtemp(join(tmpdir(), 'remark-ppt-watch-'));
  const file = join(root, 'slides.md');
  await writeFile(file, '# 旧稿');
  const preview = await createPreviewServer({ file, distDir: root, token: 'test-token', watch: true });
  const base = `http://127.0.0.1:${preview.port}`;
  let reader;
  try {
    const events = await fetch(`${base}/__events?token=test-token`, { signal: AbortSignal.timeout(5000) });
    assert.equal(events.status, 200);
    reader = events.body.getReader();
    await reader.read(); // 等待事件流连接成功
    await writeFile(join(root, 'slides.md.tmp'), '# 新稿');
    await rename(join(root, 'slides.md.tmp'), file); // Vim 常见的原子保存方式
    let message = '';
    while (!message.includes('event: change')) {
      const next = await reader.read();
      if (next.done) throw new Error('预览事件流提前结束');
      message += new TextDecoder().decode(next.value);
    }
    const deck = await fetch(`${base}/__deck.md?token=test-token`);
    assert.equal(await deck.text(), '# 新稿');
  } finally {
    await reader?.cancel();
    await preview.close();
    await rm(root, { recursive: true, force: true });
  }
});
