import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationUrl } from './presentation.js';

test('独立放映地址保留讲稿参数，清除演讲者接收端参数', () => {
  const url = new URL(presentationUrl('http://localhost:5175/?cli=1&mode=preview&token=abc&receiver&postMessageEvents=true#old'));
  assert.equal(url.searchParams.get('presentation'), '1');
  assert.equal(url.searchParams.get('token'), 'abc');
  assert.equal(url.searchParams.get('mode'), 'preview');
  assert.equal(url.searchParams.has('receiver'), false);
  assert.equal(url.searchParams.has('postMessageEvents'), false);
  assert.equal(url.hash, '');
});
