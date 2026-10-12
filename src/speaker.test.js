import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeakerOptions, syncSpeakerAppearance } from './speaker.js';

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

test('演讲者的两个 iframe 直接接收主窗口外观，切换后同步且不发送翻页状态', () => {
  const origin = 'http://localhost:5175';
  const host = { location: { origin }, addEventListener: (_, fn) => { host.listener = fn; } };
  let appearance = { font: 'lxgw', theme: 'dark' };
  const sync = syncSpeakerAppearance(host, () => appearance, () => {}, false);
  const frames = [0, 1].map(() => ({ parent: { opener: host }, messages: [], postMessage(data, target) { this.messages.push({ data, target }); } }));
  for (const source of frames) host.listener({ origin, source, data: { namespace: 'remark-speaker-appearance', type: 'request' } });
  for (const frame of frames) assert.equal(frame.messages[0].data.font, 'lxgw');
  appearance = { font: 'source', theme: 'light' };
  sync.broadcast();
  for (const frame of frames) {
    assert.equal(frame.messages[1].data.font, 'source');
    assert.equal(frame.messages[1].target, origin);
    assert.equal('state' in frame.messages[1].data, false);
  }
  const count = frames[0].messages.length;
  host.listener({ origin: 'https://other.test', source: frames[0], data: { namespace: 'remark-speaker-appearance', type: 'request' } });
  assert.equal(frames[0].messages.length, count);
});

test('演讲者 iframe 启动时请求当前字体，只接受其控制窗口回复', () => {
  const origin = 'http://localhost:5175';
  const controller = { postMessage(data, target) { controller.request = { data, target }; } };
  const frame = { location: { origin }, parent: { opener: controller }, addEventListener: (_, fn) => { frame.listener = fn; } };
  const received = [];
  syncSpeakerAppearance(frame, () => ({}), data => received.push(data.font), true);
  assert.equal(controller.request.data.type, 'request');
  const data = { namespace: 'remark-speaker-appearance', type: 'update', font: 'lxgw', theme: 'dark' };
  frame.listener({ origin, source: {}, data });
  frame.listener({ origin, source: controller, data });
  assert.deepEqual(received, ['lxgw']);
});
