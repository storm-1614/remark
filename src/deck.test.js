import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeckMetadata } from './deck.js';

test('开头署名声明被提取，第一页版式仍位于正文开头', () => {
  assert.deepEqual(parseDeckMetadata('\n<!-- brand: 叶锦维 · 25 计算机 1 班 -->\n\n<!-- layout: cover -->\n# 标题'), {
    brand: '叶锦维 · 25 计算机 1 班', content: '<!-- layout: cover -->\n# 标题',
  });
});

test('未声明、空声明和正文中的同名注释不设置署名', () => {
  assert.equal(parseDeckMetadata('# 标题').brand, null);
  assert.equal(parseDeckMetadata('<!-- brand: -->\n# 标题').brand, null);
  assert.deepEqual(parseDeckMetadata('# 标题\n<!-- brand: 其他 -->'), {
    brand: null, content: '# 标题\n<!-- brand: 其他 -->',
  });
});
