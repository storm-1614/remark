import test from 'node:test';
import assert from 'node:assert/strict';
import { Marked, marked } from 'marked';
import { sizeExtension } from './sizes.js';
import { colorExtension } from './colors.js';
import { renderSteppedMarkdown } from './steps.js';

const render = source => new Marked(sizeExtension, colorExtension).parse(source);

test('局部字号包裹段落与列表，并保留 Markdown 和颜色', () => {
  const html = render('::: size 28\n说明 **重点** :red[注意]\n\n- 第一项\n- 第二项\n:::\n\n默认段落');
  assert.match(html, /<div class="text-size" style="font-size:28px">/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /class="text-red">注意/);
  assert.match(html, /<ul>/);
  assert.match(html, /<\/div>\n<p>默认段落<\/p>/);
});

test('字号支持 12–96 的整数，非法或缺少结束标记的块保持原文', () => {
  for (const size of [12, 34, 96]) assert.match(render(`::: size ${size}\n文字\n:::`), new RegExp(`font-size:${size}px`));
  for (const size of [0, 11, 97, '28.5', '28;color:red']) assert.doesNotMatch(render(`::: size ${size}\n文字\n:::`), /class="text-size"/);
  assert.doesNotMatch(render('::: size 28\n文字'), /class="text-size"/);
});

test('代码中的字号语法与结束符不被解析', () => {
  assert.doesNotMatch(render('```md\n::: size 28\n文字\n:::\n```'), /class="text-size"/);
  const html = render('::: size 28\n```text\n:::\n```\n\n结束说明\n:::');
  assert.match(html, /<code class="language-text">:::/);
  assert.match(html, /<p>结束说明<\/p>\n<\/div>/);
});

test('逐步显示将整个字号块作为一个模块，保留引用链接', () => {
  marked.use(sizeExtension);
  const html = renderSteppedMarkdown('# 标题\n\n<!-- step -->\n::: size 26\n[补充材料][ref]\n:::\n\n[ref]: https://example.com');
  assert.match(html, /<div class="fragment"><div class="text-size" style="font-size:26px">/);
  assert.match(html, /<a href="https:\/\/example.com">补充材料<\/a>/);
});
