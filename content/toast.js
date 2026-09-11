// In-page toast notifications, isolated in a Shadow DOM so AliExpress CSS
// cannot interfere.

let hostEl = null;
let containerEl = null;

const COLORS = {
  info: '#1d4ed8',
  success: '#15803d',
  warn: '#b45309',
  error: '#b91c1c',
};

function ensureContainer() {
  if (containerEl) return containerEl;

  hostEl = document.createElement('div');
  hostEl.id = 'dps-stock-toasts';
  hostEl.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;';
  const root = hostEl.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .stack { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column;
             gap: 8px; align-items: flex-end; font-family: system-ui, sans-serif; }
    .toast { min-width: 240px; max-width: 380px; color: #fff; padding: 12px 14px;
             border-radius: 8px; font-size: 13px; line-height: 1.4; box-shadow: 0 6px 20px rgba(0,0,0,.25);
             opacity: 0; transform: translateY(-6px); transition: opacity .15s, transform .15s; }
    .toast.show { opacity: 1; transform: translateY(0); }
  `;
  root.appendChild(style);

  containerEl = document.createElement('div');
  containerEl.className = 'stack';
  root.appendChild(containerEl);

  document.documentElement.appendChild(hostEl);

  document.addEventListener('dps-stock-dismiss-toast', (ev) => {
    const id = ev.detail && ev.detail.id;
    if (!id) return;
    const el = containerEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (el) remove(el);
  });

  return containerEl;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'warn'|'error'} type
 * @param {{ sticky?: boolean, id?: string }} [opts]
 */
export function showToast(message, type = 'info', opts = {}) {
  const container = ensureContainer();

  if (opts.id) {
    const existing = container.querySelector(`[data-id="${CSS.escape(opts.id)}"]`);
    if (existing) existing.remove();
  }

  const el = document.createElement('div');
  el.className = 'toast';
  el.style.background = COLORS[type] || COLORS.info;
  el.textContent = message;
  if (opts.id) el.dataset.id = opts.id;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  if (!opts.sticky) {
    const ms = type === 'error' || type === 'warn' ? 7000 : 4000;
    setTimeout(() => remove(el), ms);
  }
  return el;
}

function remove(el) {
  el.classList.remove('show');
  setTimeout(() => el.remove(), 200);
}
