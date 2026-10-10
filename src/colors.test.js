import test from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import { colorExtension } from './colors.js';

const render = source => new Marked(colorExtension).parse(source);

test('固定调色板把 Markdown 片段渲染为颜色标记', () => {
  assert.match(render('应该:red[立即退学]，也可:blue[加粗 **重点**]。'), /<span class="text-red">立即退学<\/span>/);
  assert.match(render(':blue[加粗 **重点**]'), /<span class="text-blue">加粗 <strong>重点<\/strong><\/span>/);
});

test('未知颜色和代码中的标记保持原样', () => {
  assert.match(render(':pink[文字]'), /:pink\[文字\]/);
  assert.match(render('`:red[文字]`'), /<code>:red\[文字\]<\/code>/);
  assert.match(render('```md\n:red[文字]\n```'), /:red\[文字\]/);
});
