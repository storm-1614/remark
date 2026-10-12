import test from 'node:test';
import assert from 'node:assert/strict';
import { FONT_OPTIONS, chooseFont } from './fonts.js';

test('字体选择保留有效设置，缺省或无效设置回退到默认', () => {
  for (const key of Object.keys(FONT_OPTIONS)) assert.equal(chooseFont(key), key);
  for (const value of [null, undefined, '', 'unknown', '__proto__', 'constructor']) {
    assert.equal(chooseFont(value), 'default');
  }
});
