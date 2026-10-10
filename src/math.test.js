import test from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import { mathExtension } from './math.js';

const render = source => new Marked(mathExtension).parse(source);

test('把讲稿中的行内概率公式渲染为 KaTeX', () => {
  const formula = String.raw`$P(x_{t+1}=v_i\mid x_{\le t})=\frac{e^{z_i}}{\sum_{j=1}^{|V|}e^{z_j}}$`;
  const html = render(`##### 预测下一个 token 的概率分布 ${formula}`);
  assert.match(html, /<h5>.*class="katex"/);
  assert.doesNotMatch(html, /\$P\(/);
});

test('支持反斜杠公式定界符，代码中的公式保持原文', () => {
  assert.match(render(String.raw`概率 \(P(x)=1\)`), /class="katex"/);
  assert.match(render('`$x+y$`'), /<code>\$x\+y\$<\/code>/);
  assert.match(render('```md\n$x+y$\n```'), /\$x\+y\$/);
});
