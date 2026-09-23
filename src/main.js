import Reveal from 'reveal.js';
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
import 'reveal.js/reveal.css';
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
const cliParams = new URLSearchParams(location.search);
const cliMode = cliParams.get('cli') === '1' ? cliParams.get('mode') : null;
const cliToken = cliParams.get('token');
const cliFileName = cliParams.get('name') || 'slides.md';
const draftKey = cliMode === 'import' ? `${STORAGE_KEY}:import:${cliToken}` : STORAGE_KEY;

marked.setOptions({ gfm: true, breaks: false });
let mermaidPromise;
let chartPromise;
function getMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      htmlLabels: false,
      theme: 'base',
      themeVariables: {
        background: '#eceff4',
        primaryColor: '#e5e9f0',
        primaryTextColor: '#2e3440',
        primaryBorderColor: '#5e81ac',
        lineColor: '#5e81ac',
        secondaryColor: '#d8dee9',
        tertiaryColor: '#eceff4',
        fontFamily: 'Source Han Sans CN, sans-serif',
      },
    });
    return mermaid;
  });
  return mermaidPromise;
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
if (cliMode === 'import' || cliMode === 'present') {
  document.querySelector('#file-name-top').textContent = cliFileName;
  document.querySelector('#file-name-tab').textContent = cliFileName;
  try {
    initialContent = await loadCliDeck();
    saveStatus.textContent = cliMode === 'present' ? '来自文件' : '已导入';
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
if (cliMode === 'present') {
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
  keyboard: false,
  overview: false,
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
  prevButton.disabled = index <= 0;
  nextButton.disabled = index >= total - 1;
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
    const palette = ['#5e81ac', '#88c0d0', '#a3be8c', '#b48ead', '#d08770', '#ebcb8b'];
    chartInstances.push(new Chart(canvas, {
      type: spec.type,
      data: {
        labels: spec.labels,
        datasets: [{
          data: spec.values,
          backgroundColor: spec.type === 'doughnut' ? spec.values.map((_, i) => palette[i % palette.length]) : '#5e81ac',
          borderColor: '#5e81ac',
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
          legend: { display: spec.type === 'doughnut', position: 'right', labels: { color: '#3b4252', font: { size: 18, family: 'Source Han Sans CN' } } },
          title: { display: Boolean(spec.title), text: spec.title, color: '#2e3440', align: 'start', font: { size: 22, family: 'Source Han Sans CN', weight: 'bold' }, padding: { bottom: 18 } },
        },
        scales: spec.type === 'doughnut' ? {} : {
          x: { ticks: { color: '#4c566a', font: { size: 17, family: 'Source Han Sans CN' } }, grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#4c566a', font: { size: 16 } }, grid: { color: '#d8dee9' }, border: { display: false } },
        },
      },
    }));
  } catch (error) {
    showVisualError(host, error);
  }
}

async function renderVisuals(version) {
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
        const mermaid = await getMermaid();
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
  const pages = splitSlides(editor.value);
  const version = ++renderVersion;
  for (const chart of chartInstances.splice(0)) chart.destroy();
  slideContainer.replaceChildren();

  for (const [index, markdown] of pages.entries()) {
    const section = document.createElement('section');
    section.className = 'content-slide';
    section.setAttribute('aria-label', `第 ${index + 1} 页`);
    const content = markdown || '# 空白页面\n\n在左侧写下内容。';
    try {
      const structure = parseSlideStructure(content);
      section.classList.add(`layout-${structure.layout}`);
      if (structure.layout === 'split') {
        section.innerHTML = DOMPurify.sanitize(marked.parse(structure.title));
        const grid = document.createElement('div');
        grid.className = 'split-grid';
        for (const column of structure.columns) {
          const panel = document.createElement('div');
          panel.className = 'split-column';
          panel.innerHTML = DOMPurify.sanitize(marked.parse(column));
          grid.append(panel);
        }
        section.append(grid);
      } else {
        section.innerHTML = DOMPurify.sanitize(marked.parse(structure.content));
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
  }
  updateCounters();
}

function saveContent() {
  if (cliMode === 'present') return;
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

function enterPresent({ native = true } = {}) {
  document.body.classList.add('presenting');
  if (native && !document.fullscreenElement) previewStage.requestFullscreen?.().catch(() => {});
  requestAnimationFrame(() => deck.layout());
}

function exitPresent() {
  document.body.classList.remove('presenting');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  requestAnimationFrame(() => deck.layout());
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('presenting')) {
    document.body.classList.remove('presenting');
  }
  requestAnimationFrame(() => deck.layout());
});

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName));
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('presenting')) {
    event.preventDefault();
    exitPresent();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    enterPresent();
  } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    deck.next();
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    deck.prev();
  } else if (event.key === 'Home') {
    event.preventDefault();
    deck.slide(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    deck.slide(deck.getTotalSlides() - 1);
  }
});

document.querySelector('#present-button').addEventListener('click', () => enterPresent());
document.querySelector('#exit-button').addEventListener('click', exitPresent);
document.querySelector('#open-button').addEventListener('click', () => fileInput.click());
document.querySelector('#prev-button').addEventListener('click', () => deck.prev());
document.querySelector('#next-button').addEventListener('click', () => deck.next());

fileInput.addEventListener('change', async () => {
  if (cliMode === 'present') return;
  const file = fileInput.files?.[0];
  if (!file) return;
  editor.value = await file.text();
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
deck.on('slidechanged', updateCounters);
updateCounters();
window.addEventListener('resize', () => deck.layout());
if (cliMode === 'present') {
  enterPresent({ native: false });
  const events = new EventSource(`/__events?token=${encodeURIComponent(cliToken)}`);
  events.addEventListener('change', async () => {
    try {
      editor.value = await loadCliDeck();
      renderSlides();
      saveStatus.textContent = '已从文件更新';
    } catch {
      saveStatus.textContent = '文件读取失败';
    }
  });
}
