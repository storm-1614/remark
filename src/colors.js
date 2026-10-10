const COLOR_MARKER = /^:(red|blue|green|yellow|purple)\[([^\]\n]+)\]/;

export const colorExtension = {
  extensions: [{
    name: 'textColor',
    level: 'inline',
    start: source => source.indexOf(':'),
    tokenizer(source) {
      const match = COLOR_MARKER.exec(source);
      if (!match) return;
      return {
        type: 'textColor',
        raw: match[0],
        color: match[1],
        tokens: this.lexer.inlineTokens(match[2]),
      };
    },
    renderer(token) {
      return `<span class="text-${token.color}">${this.parser.parseInline(token.tokens)}</span>`;
    },
  }],
};
