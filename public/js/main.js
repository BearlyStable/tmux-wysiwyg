import { $, h, toast, copyText } from './util.js';
import * as store from './store.js';
import { ui, getState, update, replaceState, subscribe, undo, redo, canUndo, canRedo, encodeShare, init, saveUi } from './store.js';
import { renderPreview, needsSecondTick, removeWidget } from './ui/preview.js';
import { renderInspector } from './ui/inspector.js';
import { renderSidebar } from './ui/sidebar.js';
import { renderOutput } from './ui/output.js';
import { THEMES, TEMPLATES, applyTheme, defaultState } from './data/themes.js';
import { importConfig } from './importer.js';

const els = {};

function renderHeader() {
  els.undo.disabled = !canUndo();
  els.redo.disabled = !canRedo();
  const cur = THEMES.find((t) => t.id === getState().theme);
  els.theme.options[0].textContent = cur ? `Theme: ${cur.name}` : 'Colour theme…';
  els.theme.value = '';
  document.body.classList.toggle('output-closed', !ui.outputOpen);
  els.toggleOutput.setAttribute('aria-pressed', String(ui.outputOpen));
}

function renderAll() {
  renderHeader();
  renderPreview(els.preview);
  renderInspector(els.inspector);
  renderSidebar(els.sidebar);
  if (ui.outputOpen) renderOutput(els.output);
}

function fillSelects() {
  els.template.replaceChildren(
    h('option', { value: '' }, 'Start from template…'),
    ...TEMPLATES.map((t) => h('option', { value: t.id, title: t.desc }, `${t.name} — ${t.desc}`)));
  els.theme.replaceChildren(
    h('option', { value: '' }, 'Colour theme…'),
    ...THEMES.map((t) => h('option', { value: t.id }, t.name)));
}

function wireHeader() {
  els.template.onchange = () => {
    const t = TEMPLATES.find((x) => x.id === els.template.value);
    els.template.value = '';
    if (!t) return;
    replaceState(t.build());
    toast(`Loaded template “${t.name}” — undo with Ctrl+Z`);
  };
  els.theme.onchange = () => {
    const t = THEMES.find((x) => x.id === els.theme.value);
    els.theme.value = '';
    if (t) { update((s) => applyTheme(s, t)); toast(`Applied ${t.name}`); }
  };
  els.undo.onclick = undo;
  els.redo.onclick = redo;
  els.toggleOutput.onclick = () => { ui.outputOpen = !ui.outputOpen; saveUi(); renderAll(); };
  els.share.onclick = async () => {
    try {
      const code = await encodeShare(getState());
      const url = `${location.origin}${location.pathname}#c=${code}`;
      const ok = await copyText(url);
      toast(ok ? 'Share link copied to clipboard' : 'Could not copy the link', ok ? 'ok' : 'warn');
    } catch {
      toast('Could not create a share link in this browser', 'warn');
    }
  };
  els.reset.onclick = () => {
    if (!confirm('Start over with the default starter config? (You can undo this.)')) return;
    replaceState(defaultState());
  };

  // Import dialog
  const dlg = $('#import-dialog');
  els.import.onclick = () => { $('#import-text').value = ''; dlg.showModal(); $('#import-text').focus(); };
  $('#import-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) $('#import-text').value = await f.text();
    e.target.value = '';
  };
  $('#import-cancel').onclick = () => dlg.close();
  $('#import-form').onsubmit = (e) => {
    e.preventDefault();
    const text = $('#import-text').value;
    if (!text.trim()) { toast('Paste a config first', 'warn'); return; }
    const { state, report } = importConfig(text);
    replaceState(state);
    dlg.close();
    toast(`Imported ${report.options} options, ${report.bindings} bindings, ${report.plugins} plugins` + (report.raw ? `, ${report.raw} lines kept as raw` : ''), 'ok');
  };
}

function wireKeys() {
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (typing || mod || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search')?.focus(); $('#search')?.select(); }
    else if (e.key === 'Escape' && ui.selected) { ui.selected = null; store.refresh(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected?.kind === 'widget') { e.preventDefault(); removeWidget(ui.selected.id); }
  });
}

// Keep the preview clock running without disturbing clicks or drags.
let pointerDown = false;
let lastMinute = -1;
function tick() {
  const now = new Date();
  const due = needsSecondTick(getState()) || now.getMinutes() !== lastMinute;
  lastMinute = now.getMinutes();
  if (due && !pointerDown && !ui.dragging && !document.hidden) renderPreview(els.preview);
}

async function main() {
  Object.assign(els, {
    preview: $('#preview'), inspector: $('#inspector'), sidebar: $('#sidebar'), output: $('#output'),
    template: $('#template-select'), theme: $('#theme-select'), undo: $('#undo'), redo: $('#redo'),
    import: $('#import-btn'), share: $('#share-btn'), reset: $('#reset-btn'), toggleOutput: $('#toggle-output'),
  });
  const { fromShare } = await init();
  // On narrow screens the config is an overlay drawer: start with it closed.
  if (matchMedia('(max-width: 1280px)').matches) ui.outputOpen = false;
  els.output.addEventListener('click', (e) => {
    if (e.target.closest('.out-close')) { ui.outputOpen = false; renderAll(); }
  });
  fillSelects();
  wireHeader();
  wireKeys();
  subscribe(renderAll);
  renderAll();
  if (fromShare) toast('Loaded a shared config', 'ok');
  document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  document.addEventListener('pointerup', () => { pointerDown = false; }, true);
  document.addEventListener('pointercancel', () => { pointerDown = false; }, true);
  lastMinute = new Date().getMinutes();
  setInterval(tick, 1000);
}

main();
