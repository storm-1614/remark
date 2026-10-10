import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeakerOptions } from './speaker.js';

test('只有演讲者当前页预览可回传状态，下一页预览不能推动主窗口翻页', () => {
  assert.deepEqual(getSpeakerOptions(new URLSearchParams('receiver&postMessageEvents=true')), {
    receiver: true, postMessageEvents: true,
  });
  assert.deepEqual(getSpeakerOptions(new URLSearchParams('receiver&controls=false')), {
    receiver: true, postMessageEvents: false,
  });
  assert.deepEqual(getSpeakerOptions(new URLSearchParams('')), {
    receiver: false, postMessageEvents: false,
  });
});
