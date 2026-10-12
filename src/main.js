import Reveal from 'reveal.js';
import RevealNotes from 'reveal.js/plugin/notes';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import sql from 'highlight.js/lib/languages/sql';
import x86asm from 'highlight.js/lib/languages/x86asm';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import example from './example.md?raw';
import { splitSlides } from './slides.js';
import { parseChartSpec, parseSlideStructure } from './visuals.js';
import { getKeyboardAction } from './keyboard.js';
import { chooseTheme } from './theme.js';
import { FONT_OPTIONS, chooseFont } from './fonts.js';
import { createVimEditor } from './vim.js';
import { colorExtension } from './colors.js';
import { sizeExtension } from './sizes.js';
import { mathExtension } from './math.js';
import { renderSteppedMarkdown } from './steps.js';
import { extractSpeakerNotes } from './notes.js';
import { getSpeakerOptions, syncSpeakerAppearance } from './speaker.js';
import { parseDeckMetadata } from './deck.js';
import { presentationUrl } from './presentation.js';
import 'reveal.js/reveal.css';
import 'katex/dist/katex.min.css';
import './style.css';

const STORAGE_KEY = 'remark-ppt:slides:v1';
const editor = document.querySelector('#editor');
const slideContainer = document.querySelector('#slides');
const previewStage = document.querySelector('#preview-stage');
const fileInput = document.querySelector('#file-input');
const pageCount = document.querySelector('#page-count');
const editorCount = document.querySelector('#editor-count');
const saveStatus = document.querySelector('#save-status');
const prevButton = document.querySelector('#prev-button');
const nextButton = document.querySelector('#next-button');
const presentBrand = document.querySelector('.present-brand');
const cliParams = new URLSearchParams(location.search);
const speakerOptions = getSpeakerOptions(cliParams);
const isSpeakerReceiver = speakerOptions.receiver;
const isPresentationWindow = cliParams.get('presentation') === '1' && !isSpeakerReceiver;
let presentationWindow = null;
let applyingPresentationUpdate = false;
if (isSpeakerReceiver) document.body.classList.add('speaker-receiver');
const cliMode = cliParams.get('cli') === '1' ? cliParams.get('mode') : null;
const cliToken = cliParams.get('token');
const cliFileName = cliParams.get('name') || 'slides.md';
const draftKey = cliMode === 'import' ? `${STORAGE_KEY}:import:${cliToken}` : STORAGE_KEY;
const themeKey = 'remark-ppt:theme:v1';
const themeButton = document.querySelector('#theme-button');
let speakerAppearanceSync;
let storedTheme;
try { storedTheme = localStorage.getItem(themeKey); } catch { /* 私密模式仍可切换主题 */ }
let currentTheme = chooseTheme(storedTheme, matchMedia('(prefers-color-scheme: dark)').matches);
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#2e3440' : '#eceff4';
  themeButton.textContent = theme === 'dark' ? '浅色' : '深色';
  themeButton.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}主题`);
  speakerAppearanceSync?.broadcast();
}
applyTheme(currentTheme);

const fontKey = 'remark-ppt:font:v1';
const fontSelect = document.querySelector('#font-select');
for (const [value, option] of Object.entries(FONT_OPTIONS)) {
  fontSelect.add(new Option(option.label, value));
}
let storedFont;
try { storedFont = localStorage.getItem(fontKey); } catch { /* 禁用存储时使用默认字体 */ }
let currentFont;
let fontReady;
function applyFont(value) {
  currentFont = chooseFont(value);
  const option = FONT_OPTIONS[currentFont];
  fontSelect.value = currentFont;
  document.documentElement.style.setProperty('--slide-font', option.family);
  fontReady = option.load
    ? document.fonts.load(`34px "${option.load}"`, '幻灯片 Aa').catch(() => [])
    : Promise.resolve();
  speakerAppearanceSync?.broadcast();
}
applyFont(storedFont);

marked.setOptions({ gfm: true, breaks: false });
marked.use(colorExtension);
marked.use(sizeExtension);
marked.use(mathExtension);
let mermaidPromise;
let chartPromise;
function getMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => mermaid);
  return mermaidPromise;
}
function themeColors() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(['nord0', 'nord2', 'nord3', 'nord4', 'nord5', 'nord6', 'nord10']
    .map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
}
function getChart() {
  chartPromise ??= import('chart.js/auto').then(({ default: Chart }) => Chart);
  return chartPromise;
}
for (const [name, grammar] of Object.entries({
  javascript, typescript, python, bash, json, xml, css, c, cpp, rust, go, java, sql, x86asm,
})) hljs.registerLanguage(name, grammar);

async function loadCliDeck() {
  const response = await fetch(`/__deck.md?token=${encodeURIComponent(cliToken)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

let initialContent = example;
if (cliMode === 'import' || cliMode === 'preview' || cliMode === 'present') {
  document.querySelector('#file-name-top').textContent = cliFileName;
  document.querySelector('#file-name-tab').textContent = cliFileName;
  try {
    initialContent = await loadCliDeck();
    saveStatus.textContent = cliMode === 'preview' || cliMode === 'present' ? '本地文件' : '已导入';
    if (cliMode === 'import') {
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft !== null) {
          initialContent = draft;
          saveStatus.textContent = '浏览器已保存';
        }
      } catch { /* 禁用本地存储时仍可导入 */ }
    }
  } catch {
    initialContent = '# 无法加载 Markdown\n\n请检查命令行服务是否仍在运行。';
    saveStatus.textContent = '加载失败';
  }
} else {
  try {
    initialContent = localStorage.getItem(STORAGE_KEY) ?? example;
  } catch {
    // 禁用本地存储时，编辑与放映仍然可用。
  }
}
editor.value = initialContent;
const vimButton = document.querySelector('#vim-button');
const vimModeLabel = document.querySelector('#vim-mode');
let vimEnabled = true;
try { vimEnabled = localStorage.getItem('remark-ppt:vim:v1') !== 'off'; } catch { /* 继续使用 Vim 模式 */ }
const vim = createVimEditor(editor, updateVimStatus);
function updateVimStatus() {
  vimButton.textContent = vimEnabled ? 'Vim 开' : 'Vim 关';
  vimButton.setAttribute('aria-pressed', String(vimEnabled));
  vimModeLabel.textContent = vimEnabled ? vim.mode.toUpperCase() : '普通编辑';
  editor.dataset.vimMode = vimEnabled ? vim.mode : 'off';
}
updateVimStatus();
editor.addEventListener('keydown', event => {
  if (vimEnabled) vim.handleKey(event);
});
vimButton.addEventListener('click', () => {
  vimEnabled = !vimEnabled;
  vim.reset();
  try { localStorage.setItem('remark-ppt:vim:v1', vimEnabled ? 'on' : 'off'); } catch { /* 本次会话仍保持设置 */ }
  updateVimStatus();
  editor.focus();
});
if (cliMode === 'preview' || cliMode === 'present' || isPresentationWindow) {
  editor.readOnly = true;
  const openButton = document.querySelector('#open-button');
  openButton.hidden = true;
  openButton.disabled = true;
}

const deck = new Reveal(document.querySelector('#deck'), {
  width: 1280,
  height: 720,
  margin: 0.07,
  minScale: 0.2,
  maxScale: 2,
  controls: false,
  progress: false,
  slideNumber: false,
  hash: false,
  keyboard: true,
  plugins: [RevealNotes],
  postMessageEvents: speakerOptions.postMessageEvents,
  keyboardCondition: (event) => document.body.classList.contains('presenting') && !isTypingTarget(event.target),
  overview: true,
  transition: 'fade',
  transitionSpeed: 'fast',
});

function highlightCode() {
  slideContainer.querySelectorAll('pre code').forEach((code) => {
    const language = [...code.classList].find((name) => name.startsWith('language-'))?.slice(9);
    if (language === 'mermaid' || language === 'chart') return;
    if (language && !hljs.getLanguage(language)) {
      code.classList.remove(`language-${language}`);
      code.classList.add('language-plaintext');
    }
    hljs.highlightElement(code);
  });
}

function formatPage(index, total) {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

function updateCounters() {
  const ready = deck.isReady();
  const total = Math.max(1, ready ? deck.getTotalSlides() : slideContainer.children.length);
  const index = ready ? Math.min(deck.getIndices().h, total - 1) : 0;
  pageCount.textContent = formatPage(index, total);
  const fragments = ready ? deck.availableFragments() : { prev: false, next: false };
  prevButton.disabled = index <= 0 && !fragments.prev;
  nextButton.disabled = index >= total - 1 && !fragments.next;
  const lines = editor.value.split('\n').length;
  editorCount.textContent = `${lines} 行 · ${editor.value.length} 字`;
}

const chartInstances = [];
let renderVersion = 0;

function showVisualError(host, error) {
  host.classList.add('visual-error');
  host.textContent = `图形无法渲染：${error.message}`;
}

async function renderChart(pre, code, version) {
  const host = document.createElement('figure');
  host.className = 'visual-chart';
  pre.replaceWith(host);
  try {
    const spec = parseChartSpec(code.textContent);
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 380;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', spec.title || `${spec.type} 图表`);
    host.append(canvas);
    const Chart = await getChart();
    if (version !== renderVersion || !host.isConnected) return;
    const colors = themeColors();
    const palette = ['#5e81ac', '#88c0d0', '#a3be8c', '#b48ead', '#d08770', '#ebcb8b'];
    chartInstances.push(new Chart(canvas, {
      type: spec.type,
      data: {
        labels: spec.labels,
        datasets: [{
          data: spec.values,
          backgroundColor: spec.type === 'doughnut' ? spec.values.map((_, i) => palette[i % palette.length]) : colors.nord10,
          borderColor: colors.nord10,
          borderWidth: spec.type === 'line' ? 4 : 0,
          pointRadius: 5,
          borderRadius: spec.type === 'bar' ? 6 : 0,
          tension: 0.25,
          fill: false,
        }],
      },
      options: {
        responsive: false,
        animation: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: spec.type === 'doughnut', position: 'right', labels: { color: colors.nord0, font: { size: 18, family: FONT_OPTIONS[currentFont].family } } },
          title: { display: Boolean(spec.title), text: spec.title, color: colors.nord0, align: 'start', font: { size: 22, family: FONT_OPTIONS[currentFont].family, weight: 'bold' }, padding: { bottom: 18 } },
        },
        scales: spec.type === 'doughnut' ? {} : {
          x: { ticks: { color: colors.nord3, font: { size: 17, family: FONT_OPTIONS[currentFont].family } }, grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { color: colors.nord3, font: { size: 16, family: FONT_OPTIONS[currentFont].family } }, grid: { color: colors.nord4 }, border: { display: false } },
        },
      },
    }));
  } catch (error) {
    showVisualError(host, error);
  }
}

async function renderVisuals(version) {
  await fontReady;
  if (version !== renderVersion) return;
  const colors = themeColors();
  let mermaid;
  let diagramIndex = 0;
  for (const pre of slideContainer.querySelectorAll('pre')) {
    if (version !== renderVersion) return;
    const code = pre.querySelector('code');
    if (code?.classList.contains('language-chart')) {
      await renderChart(pre, code, version);
    } else if (code?.classList.contains('language-mermaid')) {
      const host = document.createElement('figure');
      host.className = 'visual-diagram';
      const source = code.textContent;
      pre.replaceWith(host);
      try {
        mermaid ??= await getMermaid();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          theme: 'base',
          themeVariables: {
            background: colors.nord6,
            primaryColor: colors.nord5,
            primaryTextColor: colors.nord0,
            primaryBorderColor: colors.nord10,
            lineColor: colors.nord10,
            secondaryColor: colors.nord4,
            tertiaryColor: colors.nord6,
            fontFamily: FONT_OPTIONS[currentFont].family,
          },
        });
        const { svg } = await mermaid.render(`remark-diagram-${version}-${diagramIndex++}`, source);
        if (version !== renderVersion || !host.isConnected) return;
        host.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        host.setAttribute('role', 'img');
        host.setAttribute('aria-label', '流程图');
      } catch (error) {
        if (version === renderVersion && host.isConnected) showVisualError(host, error);
      }
    }
  }
  if (version === renderVersion && deck.isReady()) deck.layout();
}

function renderSlides() {
  const currentIndex = deck.isReady() ? deck.getIndices().h : 0;
  const metadata = parseDeckMetadata(editor.value);
  const pages = splitSlides(metadata.content);
  presentBrand.textContent = metadata.brand || '';
  presentBrand.hidden = !metadata.brand;
  const version = ++renderVersion;
  for (const chart of chartInstances.splice(0)) chart.destroy();
  slideContainer.replaceChildren();

  for (const [index, markdown] of pages.entries()) {
    const section = document.createElement('section');
    section.className = 'content-slide';
    section.setAttribute('aria-label', `第 ${index + 1} 页`);
    const content = markdown || '# 空白页面\n\n在左侧写下内容。';
    try {
      const { content: visibleContent, notes } = extractSpeakerNotes(content);
      const structure = parseSlideStructure(visibleContent);
      section.classList.add(`layout-${structure.layout}`);
      if (structure.layout === 'split') {
        section.innerHTML = DOMPurify.sanitize(renderSteppedMarkdown(structure.title));
        const grid = document.createElement('div');
        grid.className = 'split-grid';
        for (const column of structure.columns) {
          const panel = document.createElement('div');
          panel.className = 'split-column';
          panel.innerHTML = DOMPurify.sanitize(renderSteppedMarkdown(column));
          grid.append(panel);
        }
        section.append(grid);
      } else {
        section.innerHTML = DOMPurify.sanitize(renderSteppedMarkdown(structure.content));
      }
      if (notes) {
        const aside = document.createElement('aside');
        aside.className = 'notes';
        aside.innerHTML = DOMPurify.sanitize(marked.parse(notes));
        section.append(aside);
      }
    } catch (error) {
      section.textContent = `幻灯片格式错误：${error.message}`;
    }
    if (cliMode) {
      for (const image of section.querySelectorAll('img[src]')) {
        const source = image.getAttribute('src');
        if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(source)) continue;
        const asset = new URL('/__asset', location.origin);
        let assetPath = source.split(/[?#]/, 1)[0];
        try { assetPath = decodeURIComponent(assetPath); } catch { /* 保留原路径 */ }
        asset.searchParams.set('path', assetPath);
        asset.searchParams.set('token', cliToken);
        image.src = asset.href;
      }
    }
    slideContainer.append(section);
  }
  void renderVisuals(version);
  highlightCode();

  if (deck.isReady()) {
    deck.sync();
    deck.slide(Math.min(currentIndex, pages.length - 1));
    deck.layout();
    // 同一页的源文件内容更新也要通知演讲者窗口刷新备注。
    deck.dispatchEvent({ type: 'slidechanged', data: {
      indexh: deck.getIndices().h, indexv: deck.getIndices().v, currentSlide: deck.getCurrentSlide(),
    } });
  }
  updateCounters();
  if (deck.isReady()) sendPresentationUpdate();
}

function sendPresentationUpdate() {
  if (applyingPresentationUpdate || isSpeakerReceiver || isPresentationWindow || !presentationWindow || presentationWindow.closed) return;
  presentationWindow.postMessage({ namespace: 'remark-presentation', type: 'update',
    content: editor.value, theme: currentTheme, font: currentFont, state: deck.getState() }, location.origin);
}

function openPresentation() {
  if (isPresentationWindow || isSpeakerReceiver) { enterPresent(); return; }
  if (presentationWindow && !presentationWindow.closed) {
    sendPresentationUpdate();
    presentationWindow.focus();
    return;
  }
  presentationWindow = window.open(presentationUrl(location.href), 'remark-presentation', 'popup,width=1280,height=800');
  if (!presentationWindow) saveStatus.textContent = '请允许弹窗以打开放映窗口';
}

function saveContent() {
  if (cliMode === 'preview' || cliMode === 'present') return;
  try {
    localStorage.setItem(draftKey, editor.value);
    saveStatus.textContent = cliMode === 'import' ? '浏览器已保存' : '已保存';
  } catch {
    saveStatus.textContent = '无法自动保存';
  }
}

let renderTimer;
editor.addEventListener('input', () => {
  saveStatus.textContent = '保存中…';
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderSlides();
    saveContent();
  }, 120);
});
themeButton.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  try { localStorage.setItem(themeKey, currentTheme); } catch { /* 本次会话仍保持主题 */ }
  renderSlides();
});
fontSelect.addEventListener('change', () => {
  applyFont(fontSelect.value);
  try { localStorage.setItem(fontKey, currentFont); } catch { /* 本次会话仍保持字体 */ }
  renderSlides();
});
window.addEventListener('storage', event => {
  if (event.key === fontKey && chooseFont(event.newValue) !== currentFont) {
    applyFont(event.newValue);
    renderSlides();
  }
});

function enterPresent({ native = true } = {}) {
  document.body.classList.add('presenting');
  if (native && !document.fullscreenElement) previewStage.requestFullscreen?.().catch(() => {});
  requestAnimationFrame(() => deck.layout());
}

function exitPresent() {
  if (isPresentationWindow) { window.close(); return; }
  document.body.classList.remove('presenting');
  deck.toggleOverview(false);
  deck.togglePause(false);
  deck.closeOverlay();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  requestAnimationFrame(() => deck.layout());
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('presenting')) {
    exitPresent();
    return;
  }
  requestAnimationFrame(() => deck.layout());
});

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName));
}

document.addEventListener('keydown', (event) => {
  const action = getKeyboardAction({
    key: event.key,
    presenting: document.body.classList.contains('presenting'),
    typing: isTypingTarget(event.target),
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  });
  if (!action || action === 'native') return;
  if (action === 'exit' && (deck.isOverview() || deck.isOverlayOpen())) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (action === 'notes') {
    if (!event.repeat && !isSpeakerReceiver) deck.getPlugin('notes').open();
  }
  else if (action === 'show' || action === 'enter') openPresentation();
  else if (action === 'exit') exitPresent();
  else if (action === 'next') deck.next();
  else if (action === 'prev') deck.prev();
  else if (action === 'first') deck.slide(0);
  else if (action === 'last') deck.slide(deck.getTotalSlides() - 1);
});

document.querySelector('#present-button').addEventListener('click', openPresentation);
document.querySelector('#exit-button').addEventListener('click', exitPresent);
document.querySelector('#fullscreen-button').addEventListener('click', () => enterPresent());
document.querySelector('#open-button').addEventListener('click', () => fileInput.click());
document.querySelector('#prev-button').addEventListener('click', () => deck.prev());
document.querySelector('#next-button').addEventListener('click', () => deck.next());

fileInput.addEventListener('change', async () => {
  if (cliMode === 'preview' || cliMode === 'present') return;
  const file = fileInput.files?.[0];
  if (!file) return;
  editor.value = await file.text();
  vim.reset();
  renderSlides();
  saveContent();
  fileInput.value = '';
});

document.querySelector('#download-button').addEventListener('click', () => {
  const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = cliMode ? cliFileName : 'slides.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderSlides();
await deck.initialize();
speakerAppearanceSync = syncSpeakerAppearance(window,
  () => ({ font: currentFont, theme: currentTheme }),
  appearance => {
    const fontChanged = Object.hasOwn(FONT_OPTIONS, appearance.font) && appearance.font !== currentFont;
    const themeChanged = ['light', 'dark'].includes(appearance.theme) && appearance.theme !== currentTheme;
    if (fontChanged) applyFont(appearance.font);
    if (themeChanged) applyTheme(appearance.theme);
    if (fontChanged || themeChanged) renderSlides();
  }, isSpeakerReceiver);
deck.removeKeyBinding(83);
deck.addKeyBinding({ keyCode: 80, key: 'P', description: '演讲者视图' }, () => {
  if (!isSpeakerReceiver) deck.getPlugin('notes').open();
});
if (isSpeakerReceiver || isPresentationWindow) enterPresent({ native: false });
document.querySelector('#fullscreen-button').hidden = !isPresentationWindow;
deck.registerKeyboardShortcut('ESC, O', '退出放映 / 幻灯片总览');
deck.on('slidechanged', updateCounters);
deck.on('fragmentshown', updateCounters);
deck.on('fragmenthidden', updateCounters);
for (const name of ['slidechanged', 'fragmentshown', 'fragmenthidden', 'paused', 'resumed']) {
  deck.on(name, () => {
    if (applyingPresentationUpdate || isSpeakerReceiver) return;
    if (isPresentationWindow && window.opener && !window.opener.closed) {
      window.opener.postMessage({ namespace: 'remark-presentation', type: 'state', state: deck.getState() }, location.origin);
    } else sendPresentationUpdate();
  });
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.namespace !== 'remark-presentation') return;
  const message = event.data;
  if (isPresentationWindow && event.source === window.opener && message.type === 'update' && typeof message.content === 'string') {
    applyingPresentationUpdate = true;
    try {
      const themeChanged = (message.theme === 'light' || message.theme === 'dark') && message.theme !== currentTheme;
      const fontChanged = typeof message.font === 'string' && chooseFont(message.font) !== currentFont;
      if (editor.value !== message.content || themeChanged || fontChanged) {
        editor.value = message.content;
        vim.reset();
        if (themeChanged) applyTheme(message.theme);
        if (fontChanged) applyFont(message.font);
        renderSlides();
      }
      deck.setState(message.state);
    } finally { applyingPresentationUpdate = false; }
  } else if (!isPresentationWindow && presentationWindow && event.source === presentationWindow) {
    if (message.type === 'request') sendPresentationUpdate();
    else if (message.type === 'state' && message.state && typeof message.state === 'object') {
      applyingPresentationUpdate = true;
      try { deck.setState(message.state); } finally { applyingPresentationUpdate = false; }
    }
  }
});
if (isPresentationWindow && window.opener) {
  window.opener.postMessage({ namespace: 'remark-presentation', type: 'request' }, location.origin);
}
updateCounters();
window.addEventListener('resize', () => deck.layout());
if (cliMode === 'preview' || cliMode === 'present') {
  if (cliMode === 'present') enterPresent({ native: false });
  const events = new EventSource(`/__events?token=${encodeURIComponent(cliToken)}`);
  events.addEventListener('change', async () => {
    try {
      editor.value = await loadCliDeck();
      vim.reset();
      renderSlides();
      saveStatus.textContent = '已从文件更新';
    } catch {
      saveStatus.textContent = '文件读取失败';
    }
  });
}
