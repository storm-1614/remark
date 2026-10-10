import test from 'node:test';
import assert from 'node:assert/strict';
import { createVimEditor } from './vim.js';

function editor(value) {
  return {
    value, selectionStart: 0, selectionEnd: 0, readOnly: false, changes: 0,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    setRangeText(text, start, end) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      this.setSelectionRange(start + text.length, start + text.length);
    },
    dispatchEvent() { this.changes++; },
  };
}

function press(vim, key, modifiers = {}) {
  let prevented = false;
  vim.handleKey({ key, preventDefault() { prevented = true; }, ...modifiers });
  return prevented;
}

test('Vim 普通模式移动，i/Escape 切换插入模式', () => {
  const field = editor('hello world\nsecond');
  const vim = createVimEditor(field);
  press(vim, 'l');
  assert.equal(field.selectionStart, 1);
  press(vim, 'w');
  assert.equal(field.selectionStart, 6);
  press(vim, 'j');
  assert.equal(field.selectionStart, 18);
  press(vim, 'g'); press(vim, 'g');
  assert.equal(field.selectionStart, 0);
  press(vim, 'i');
  assert.equal(vim.mode, 'insert');
  assert.equal(press(vim, 'z'), false);
  press(vim, 'Escape');
  assert.equal(vim.mode, 'normal');
});

test('Vim 删除、复制、粘贴和撤销同步触发输入事件', () => {
  const field = editor('alpha\nbeta\n');
  const vim = createVimEditor(field);
  press(vim, 'y'); press(vim, 'y');
  press(vim, 'p');
  assert.equal(field.value, 'alpha\nalpha\nbeta\n');
  press(vim, 'd'); press(vim, 'd');
  assert.equal(field.value, 'alpha\nbeta\n');
  press(vim, 'u');
  assert.equal(field.value, 'alpha\nalpha\nbeta\n');
  assert.equal(field.changes, 3);
});

test('只读编辑器不接受 Vim 编辑命令', () => {
  const field = editor('abc');
  field.readOnly = true;
  const vim = createVimEditor(field);
  press(vim, 'x');
  assert.equal(field.value, 'abc');
});

test('末行无换行符时，整行删除和粘贴保持正确行结构', () => {
  const field = editor('first\nlast');
  field.setSelectionRange(6, 6);
  const vim = createVimEditor(field);
  press(vim, 'y'); press(vim, 'y');
  press(vim, 'p');
  assert.equal(field.value, 'first\nlast\nlast');
  press(vim, 'd'); press(vim, 'd');
  assert.equal(field.value, 'first\nlast');
});
