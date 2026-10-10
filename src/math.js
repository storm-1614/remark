import katex from 'katex';

function readFormula(source) {
  if (source.startsWith('\\(')) {
    const end = source.indexOf('\\)', 2);
    if (end < 0 || source.slice(2, end).includes('\n')) return null;
    return { raw: source.slice(0, end + 2), formula: source.slice(2, end) };
  }
  if (!source.startsWith('$') || source.startsWith('$$')) return null;
  for (let index = 1; index < source.length; index++) {
    if (source[index] === '\n') return null;
    if (source[index] === '\\') { index++; continue; }
    if (source[index] === '$') {
      return { raw: source.slice(0, index + 1), formula: source.slice(1, index) };
    }
  }
  return null;
}

export const mathExtension = {
  extensions: [{
    name: 'inlineMath',
    level: 'inline',
    start: source => {
      const dollar = source.indexOf('$');
      const slash = source.indexOf('\\(');
      if (dollar < 0) return slash;
      if (slash < 0) return dollar;
      return Math.min(dollar, slash);
    },
    tokenizer(source) {
      const match = readFormula(source);
      if (!match || !match.formula.trim()) return;
      return { type: 'inlineMath', ...match };
    },
    renderer(token) {
      return katex.renderToString(token.formula, { displayMode: false, throwOnError: false, trust: false });
    },
  }],
};
