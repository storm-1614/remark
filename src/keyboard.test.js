import test from 'node:test';
import assert from 'node:assert/strict';
import { getKeyboardAction } from './keyboard.js';

test('P 在预览和放映中打开演讲者视图，不占用编辑输入', () => {
  for (const presenting of [false, true]) {
    assert.equal(getKeyboardAction({ key: 'p', presenting }), 'notes');
    assert.equal(getKeyboardAction({ key: 'P', presenting }), 'notes');
    assert.equal(getKeyboardAction({ key: 'p', presenting, typing: true }), null);
  }
});

test('预览模式保留 F 放映和基本翻页', () => {
  assert.equal(getKeyboardAction({ key: 'f', presenting: false }), 'enter');
  assert.equal(getKeyboardAction({ key: 'ArrowRight', presenting: false }), 'next');
  assert.equal(getKeyboardAction({ key: 'PageUp', presenting: false }), 'prev');
});

test('S 在预览模式进入放映，并且不占用编辑输入', () => {
  assert.equal(getKeyboardAction({ key: 's', presenting: false }), 'show');
  assert.equal(getKeyboardAction({ key: 'S', presenting: false }), 'show');
  assert.equal(getKeyboardAction({ key: 's', presenting: false, typing: true }), null);
  assert.equal(getKeyboardAction({ key: 's', presenting: true }), 'native');
});

test('放映模式将 reveal.js 原生快捷键交还给引擎', () => {
  for (const key of ['j', 'n', 'o', 'b', '.', '?', 'ArrowRight', ' ']) {
    assert.equal(getKeyboardAction({ key, presenting: true }), 'native');
  }
  assert.equal(getKeyboardAction({ key: 'Escape', presenting: true }), 'exit');
});

test('输入框和组合键不抢占输入', () => {
  assert.equal(getKeyboardAction({ key: 'f', presenting: false, typing: true }), null);
  assert.equal(getKeyboardAction({ key: 'f', presenting: false, ctrlKey: true }), null);
  assert.equal(getKeyboardAction({ key: 'ArrowRight', presenting: false, altKey: true }), null);
});
