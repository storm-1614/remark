import { marked } from 'marked';

/** 通过 Markdown token 识别步骤，避免把代码里的注释当作分隔符。 */
export function renderSteppedMarkdown(source) {
  const tokens = marked.lexer(source);
  const chunks = [];
  let group = [];
  let stepped = false;
  const flush = () => {
    if (!group.some(token => token.type !== 'space')) { group = []; return; }
    group.links = tokens.links;
    const html = marked.parser(group);
    chunks.push(stepped ? `<div class="fragment">${html}</div>` : html);
    group = [];
  };
  for (const token of tokens) {
    if (token.type === 'html' && token.text.trim() === '<!-- step -->') {
      flush();
      stepped = true;
    } else group.push(token);
  }
  flush();
  return chunks.join('');
}
