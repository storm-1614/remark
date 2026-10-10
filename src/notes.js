import { marked } from 'marked';

/** 备注只在顶层注释标记后开始，代码示例中的同名标记仍作为正文。 */
export function extractSpeakerNotes(source) {
  const normalized = source.replace(/\r\n?/g, '\n');
  const tokens = marked.lexer(normalized);
  let offset = 0;
  for (const token of tokens) {
    const tokenStart = normalized.indexOf(token.raw, offset);
    if (token.type === 'html' && token.text.trim() === '<!-- notes -->') {
      return { content: normalized.slice(0, tokenStart).trimEnd(), notes: normalized.slice(tokenStart + token.raw.length).trim() };
    }
    offset = tokenStart + token.raw.length;
  }
  return { content: source, notes: '' };
}
