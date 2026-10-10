/** 文档开头的署名声明不会进入幻灯片正文。 */
export function parseDeckMetadata(source) {
  const match = source.match(/^\uFEFF?\s*<!--\s*brand:\s*([^\r\n]*?)\s*-->[ \t]*(?:\r?\n|$)/);
  if (!match) return { brand: null, content: source };
  return { brand: match[1].trim() || null, content: source.slice(match[0].length).trimStart() };
}
