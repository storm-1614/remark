/** 将 Markdown 按独立的 --- 分页，忽略围栏代码块中的分隔线。 */
export function splitSlides(source) {
  const pages = [];
  let lines = [];
  let fence = null;

  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      const marker = match[1];
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    }

    if (!fence && /^\s{0,3}---\s*$/.test(line)) {
      pages.push(lines.join('\n').trim());
      lines = [];
    } else {
      lines.push(line);
    }
  }

  pages.push(lines.join('\n').trim());
  return pages;
}
