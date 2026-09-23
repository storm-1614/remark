import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSlides } from './slides.js';

test('用独立的 --- 分隔页面', () => {
  assert.deepEqual(splitSlides('# 第一页\n\n---\n\n# 第二页'), ['# 第一页', '# 第二页']);
});

test('代码块中的 --- 不分隔页面', () => {
  assert.deepEqual(splitSlides('```md\n---\n```\n---\n结束'), ['```md\n---\n```', '结束']);
});

test('空文档仍然保留一页', () => {
  assert.deepEqual(splitSlides('  \n'), ['']);
});
