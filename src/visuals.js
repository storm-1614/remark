const LAYOUTS = new Set(['default', 'cover', 'section', 'statement', 'split']);
const CHART_TYPES = new Set(['bar', 'line', 'doughnut']);

export function parseSlideStructure(markdown) {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  const match = normalized.match(/^<!--\s*layout:\s*([a-z]+)\s*-->\s*\n/i);
  const layout = match?.[1]?.toLowerCase() ?? 'default';
  if (!LAYOUTS.has(layout)) throw new Error(`未知版式：${layout}`);
  const content = match ? normalized.slice(match[0].length).trim() : normalized;
  if (layout !== 'split') return { layout, content };

  const divider = /^\s*<!--\s*column\s*-->\s*$/im;
  const parts = content.split(divider);
  if (parts.length !== 2) throw new Error('双栏版式需要一个 <!-- column --> 分栏标记');
  const heading = parts[0].match(/^(#{1,2}\s+[^\n]+)\s*\n?/);
  if (!heading) throw new Error('双栏版式需要以标题开头');
  const columns = [parts[0].slice(heading[0].length).trim(), parts[1].trim()];
  return { layout, title: heading[1], columns };
}

export function parseChartSpec(source) {
  const fields = new Map();
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-z]+):\s*(.*?)\s*$/i);
    if (!match) throw new Error(`图表配置格式错误：${line.trim()}`);
    const key = match[1].toLowerCase();
    if (!['type', 'title', 'labels', 'values'].includes(key) || fields.has(key)) {
      throw new Error(`未知或重复的图表字段：${key}`);
    }
    fields.set(key, match[2]);
  }
  const type = fields.get('type') || 'bar';
  if (!CHART_TYPES.has(type)) throw new Error('图表类型只能是 bar、line 或 doughnut');
  const labels = (fields.get('labels') || '').split(',').map(value => value.trim()).filter(Boolean);
  const rawValues = (fields.get('values') || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!labels.length || labels.length > 12 || labels.length !== rawValues.length) {
    throw new Error('图表标签与数值数量须一致，且为 1–12 项');
  }
  const values = rawValues.map(value => Number(value));
  if (values.some((value, index) => !Number.isFinite(value) || !/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(rawValues[index]))) {
    throw new Error('图表数值必须是有限数字');
  }
  if (type === 'doughnut' && values.some(value => value < 0)) throw new Error('环形图数值不能为负');
  return { type, title: fields.get('title') || '', labels, values };
}
