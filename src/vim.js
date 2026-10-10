/** 原生 textarea 的轻量 Vim 控制；只接管编辑框内的按键。 */
export function createVimEditor(editor, onModeChange = () => {}) {
  let mode = 'normal';
  let pending = '';
  let register = '';
  let linewise = false;
  let insertSnapshot = null;
  const undo = [];
  const redo = [];

  const position = () => editor.selectionStart;
  const startOfLine = (pos = position()) => editor.value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const endOfLine = (pos = position()) => {
    const end = editor.value.indexOf('\n', pos);
    return end < 0 ? editor.value.length : end;
  };
  const select = pos => editor.setSelectionRange(Math.max(0, Math.min(pos, editor.value.length)), Math.max(0, Math.min(pos, editor.value.length)));
  const notify = () => onModeChange(mode);
  const input = () => editor.dispatchEvent(new Event('input', { bubbles: true }));
  const snapshot = () => ({ value: editor.value, cursor: position() });
  const remember = () => { undo.push(snapshot()); redo.length = 0; };
  const replace = (start, end, text, cursor) => {
    remember();
    editor.setRangeText(text, start, end);
    select(cursor);
    input();
  };
  const restore = (from, to) => {
    if (!from.length) return;
    to.push(snapshot());
    const previous = from.pop();
    editor.value = previous.value;
    select(previous.cursor);
    input();
  };
  const word = char => /[\p{L}\p{N}_]/u.test(char || '');
  const nextWord = () => {
    const value = editor.value;
    let at = Math.min(position() + 1, value.length);
    while (at < value.length && word(value[at])) at++;
    while (at < value.length && !word(value[at])) at++;
    select(at);
  };
  const prevWord = () => {
    const value = editor.value;
    let at = Math.max(0, position() - 1);
    while (at > 0 && !word(value[at])) at--;
    while (at > 0 && word(value[at - 1])) at--;
    select(at);
  };
  const vertical = direction => {
    const column = position() - startOfLine();
    const target = direction > 0 ? endOfLine() + 1 : startOfLine() - 1;
    if (target < 0 || target > editor.value.length) return;
    const lineStart = startOfLine(target);
    select(Math.min(lineStart + column, endOfLine(target)));
  };
  const enterInsert = cursor => {
    if (editor.readOnly) return;
    select(cursor);
    insertSnapshot = snapshot();
    mode = 'insert';
    notify();
  };

  function handleKey(event) {
    if (event.isComposing) return;
    if (mode === 'insert') {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (insertSnapshot && editor.value !== insertSnapshot.value) {
        undo.push(insertSnapshot);
        redo.length = 0;
      }
      insertSnapshot = null;
      mode = 'normal';
      select(Math.max(startOfLine(), position() - 1));
      notify();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      restore(redo, undo);
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    const key = event.key;
    if (pending) {
      const command = pending;
      pending = '';
      if (command === 'g' && key === 'g') select(0);
      if ((command === 'd' || command === 'y') && key === command) {
        const start = startOfLine();
        const lineEnd = endOfLine();
        const end = Math.min(editor.value.length, lineEnd + 1);
        register = `${editor.value.slice(start, lineEnd)}\n`;
        linewise = true;
        if (command === 'd' && !editor.readOnly) {
          const from = lineEnd === editor.value.length && start > 0 ? start - 1 : start;
          replace(from, end, '', Math.min(from, editor.value.length - (end - from)));
        }
      }
      return;
    }
    switch (key) {
      case 'h': select(position() - 1); break;
      case 'l': select(position() + 1); break;
      case 'j': vertical(1); break;
      case 'k': vertical(-1); break;
      case 'w': nextWord(); break;
      case 'b': prevWord(); break;
      case '0': select(startOfLine()); break;
      case '$': select(endOfLine()); break;
      case 'G': select(startOfLine(editor.value.length)); break;
      case 'g': case 'd': case 'y': pending = key; break;
      case 'i': enterInsert(position()); break;
      case 'a': enterInsert(Math.min(position() + 1, endOfLine())); break;
      case 'I': enterInsert(startOfLine()); break;
      case 'A': enterInsert(endOfLine()); break;
      case 'o': if (!editor.readOnly) { const at = endOfLine(); replace(at, at, '\n', at + 1); enterInsert(at + 1); } break;
      case 'O': if (!editor.readOnly) { const at = startOfLine(); replace(at, at, '\n', at); enterInsert(at); } break;
      case 'x': if (!editor.readOnly && position() < endOfLine()) replace(position(), position() + 1, '', position()); break;
      case 'p': if (!editor.readOnly && register) {
        const at = linewise ? Math.min(editor.value.length, endOfLine() + 1) : Math.min(editor.value.length, position() + 1);
        const text = linewise && at === editor.value.length && !editor.value.endsWith('\n')
          ? `\n${register.slice(0, -1)}` : register;
        replace(at, at, text, at);
      } break;
      case 'u': restore(undo, redo); break;
      case 'Escape': pending = ''; break;
      default: break;
    }
  }

  return {
    get mode() { return mode; },
    handleKey,
    reset() { pending = ''; undo.length = 0; redo.length = 0; insertSnapshot = null; mode = 'normal'; notify(); },
  };
}
