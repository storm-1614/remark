import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTheme } from './theme.js';

test('主题优先使用已保存的选择，否则跟随系统', () => {
  assert.equal(chooseTheme('dark', false), 'dark');
  assert.equal(chooseTheme('light', true), 'light');
  assert.equal(chooseTheme(null, true), 'dark');
  assert.equal(chooseTheme(null, false), 'light');
  assert.equal(chooseTheme('invalid', true), 'dark');
});
