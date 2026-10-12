export const sizeExtension = {
  extensions: [{
    name: 'textSize',
    level: 'block',
    start: source => source.search(/^ {0,3}::: size /m),
    tokenizer(source) {
      const opening = /^ {0,3}::: size (\d+)[ \t]*\n/.exec(source);
      if (!opening) return;
      const size = Number(opening[1]);
      if (size < 12 || size > 96) return;
      let offset = opening[0].length;
      let fence = null;
      for (const match of source.slice(offset).matchAll(/[^\n]*(?:\n|$)/g)) {
        if (!match[0]) break;
        const line = match[0].replace(/\n$/, '');
        const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (fence) {
          if (delimiter && delimiter[1][0] === fence.char && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = null;
        } else if (delimiter) {
          fence = { char: delimiter[1][0], length: delimiter[1].length };
        } else if (/^ {0,3}:::[ \t]*$/.test(line)) {
          return {
            type: 'textSize',
            raw: source.slice(0, offset + match[0].length),
            size,
            tokens: this.lexer.blockTokens(source.slice(opening[0].length, offset)),
          };
        }
        offset += match[0].length;
      }
    },
    renderer(token) {
      return `<div class="text-size" style="font-size:${token.size}px">${this.parser.parse(token.tokens)}</div>\n`;
    },
  }],
};
