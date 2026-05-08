// utils.js — shared pure helpers used across modules

/**
 * HTML-escapes a value for safe insertion into innerHTML.
 */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats a duration in seconds as m:ss.
 */
export function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Shows a transient toast notification.
 * Creates the element on first call; reuses it thereafter.
 */
let _toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('rn-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rn-toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
