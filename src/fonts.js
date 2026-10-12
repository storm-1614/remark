export const FONT_OPTIONS = Object.freeze({
  default: { label: '默认', family: '"JetBrainsMono Nerd Font", "Source Han Sans CN", sans-serif', load: 'Source Han Sans CN' },
  source: { label: '思源黑体', family: '"Source Han Sans CN", sans-serif', load: 'Source Han Sans CN' },
  lxgw: { label: 'LXGW 霞鹜文楷', family: '"LXGW WenKai", "Source Han Sans CN", sans-serif', load: 'LXGW WenKai' },
  system: { label: '系统字体', family: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', load: null },
});

export function chooseFont(value) {
  return Object.hasOwn(FONT_OPTIONS, value) ? value : 'default';
}
