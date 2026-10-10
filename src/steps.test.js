import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSteppedMarkdown } from './steps.js';

test('标题先显示，后续模块分别成为逐步显示组', () => {
  const html = renderSteppedMarkdown('# 标题\n\n<!-- step -->\n\n第一组\n\n- 要点\n\n<!-- step -->\n\n第二组');
  assert.match(html, /^<h1>标题<\/h1>/);
  assert.equal((html.match(/class="fragment"/g) || []).length, 2);
  assert.match(html, /class="fragment"><p>第一组<\/p>\n<ul>/);
});

test('代码中的标记不产生步骤，空步骤不占一次按键', () => {
  const html = renderSteppedMarkdown('```html\n<!-- step -->\n```\n\n<!-- step -->\n\n<!-- step -->\n\n结论');
  assert.equal((html.match(/class="fragment"/g) || []).length, 1);
  assert.match(html, /&lt;!-- step --&gt;/);
});
