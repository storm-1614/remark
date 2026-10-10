import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSpeakerNotes } from './notes.js';

test('备注标记后的 Markdown 从投影内容中分离', () => {
  const result = extractSpeakerNotes('# 标题\n\n<!-- step -->\n\n要点\n\n<!-- notes -->\n\n## 提醒\n- 讲例子');
  assert.match(result.content, /<!-- step -->/);
  assert.doesNotMatch(result.content, /提醒|讲例子/);
  assert.equal(result.notes, '## 提醒\n- 讲例子');
});

test('代码中的备注标记不会截断正文', () => {
  const source = '# 标题\n\n```html\n<!-- notes -->\n```\n\n正文';
  assert.deepEqual(extractSpeakerNotes(source), { content: source, notes: '' });
});

test('引用链接定义和 Windows 换行不影响备注边界', () => {
  const result = extractSpeakerNotes('[链接][ref]\r\n\r\n[ref]: https://example.com\r\n\r\n<!-- notes -->\r\n\r\n提醒');
  assert.match(result.content, /\[ref\]: https:\/\/example.com/);
  assert.equal(result.notes, '提醒');
});
