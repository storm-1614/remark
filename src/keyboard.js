/** 在预览模式处理少量快捷键，放映时交由 reveal.js 接管。 */
export function getKeyboardAction({ key, presenting, typing = false, altKey = false, ctrlKey = false, metaKey = false }) {
  if (typing || altKey || ctrlKey || metaKey) return null;
  if (key.toLowerCase() === 'p') return 'notes';
  if (presenting) return key === 'Escape' ? 'exit' : 'native';
  if (key.toLowerCase() === 's') return 'show';
  if (key.toLowerCase() === 'f') return 'enter';
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(key)) return 'next';
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) return 'prev';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}
