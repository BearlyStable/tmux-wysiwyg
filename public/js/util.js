// Small DOM + misc helpers shared by every module.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Hyperscript-style element factory: h('div', {class: 'x', onclick}, child, ...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

let counter = 0;
export const uid = () => Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Re-render a container while keeping keyboard focus, caret position and
 * scroll offsets. Inputs opt in with data-fk="unique-key", scrollers with data-sk.
 */
export function preserveFocus(container, fn) {
  const a = document.activeElement;
  let key = null, sel = null;
  if (a && container.contains(a) && a.dataset && a.dataset.fk) {
    key = a.dataset.fk;
    try { sel = [a.selectionStart, a.selectionEnd]; } catch { sel = null; }
  }
  const scrolls = $$('[data-sk]', container).map((e) => [e.dataset.sk, e.scrollTop]);
  fn();
  for (const [k, top] of scrolls) {
    const n = container.querySelector(`[data-sk="${CSS.escape(k)}"]`);
    if (n) n.scrollTop = top;
  }
  if (key) {
    const n = container.querySelector(`[data-fk="${CSS.escape(key)}"]`);
    if (n) {
      n.focus({ preventScroll: true });
      if (sel && sel[0] != null) { try { n.setSelectionRange(sel[0], sel[1]); } catch { /* not a text input */ } }
    }
  }
}

let toastTimer;
export function toast(msg, kind = 'info') {
  let el = $('#toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.textContent = msg;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
