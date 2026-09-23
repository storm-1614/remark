import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCliArgs, resolveAssetPath } from './cli-core.mjs';

test('解析可供 NeoVim 调用的放映参数', () => {
  assert.deepEqual(
    parseCliArgs(['present', '讲稿.md', '--no-open', '--json', '--port', '0']),
    { command: 'present', file: '讲稿.md', open: false, json: true, port: 0 },
  );
});

test('导入命令默认打开浏览器并自动选择端口', () => {
  assert.deepEqual(
    parseCliArgs(['import', 'slides.md']),
    { command: 'import', file: 'slides.md', open: true, json: false, port: 0 },
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
