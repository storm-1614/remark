import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChartSpec, parseSlideStructure } from './visuals.js';

test('解析可直接写在 Markdown 围栏里的数据图', () => {
  assert.deepEqual(parseChartSpec('type: bar\ntitle: 活动报名\nlabels: 一班, 二班, 三班\nvalues: 18, 24, 21'), {
    type: 'bar', title: '活动报名', labels: ['一班', '二班', '三班'], values: [18, 24, 21],
  });
});

test('图表拒绝不匹配的数据和非法类型', () => {
  assert.throws(() => parseChartSpec('type: bar\nlabels: A, B\nvalues: 1'), /数量/);
  assert.throws(() => parseChartSpec('type: scatter\nlabels: A\nvalues: 1'), /类型/);
  assert.throws(() => parseChartSpec('type: line\nlabels: A\nvalues: NaN'), /数值/);
});

test('解析封面版式与双栏版式', () => {
  assert.deepEqual(parseSlideStructure('<!-- layout: cover -->\n# 项目报告\n\n团队名称'), {
    layout: 'cover', content: '# 项目报告\n\n团队名称',
  });
  assert.deepEqual(parseSlideStructure('<!-- layout: split -->\n# 对比\n\n左侧\n\n<!-- column -->\n\n右侧'), {
    layout: 'split', title: '# 对比', columns: ['左侧', '右侧'],
  });
});
