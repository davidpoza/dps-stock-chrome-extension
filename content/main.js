// Content-script entrypoint (ES module, loaded via content.js).
// Injects the capture buttons, keeps them in sync with the SPA's dynamic
// rendering, and orchestrates capture -> confirm -> save.

import { aliexpressAdapter } from '../stores/aliexpress.js';
import { amazonAdapter } from '../stores/amazon.js';
import { openDialog } from './dialog.js';
import { showToast } from './toast.js';

const ADAPTERS = [aliexpressAdapter, amazonAdapter];
const MARK = 'data-dps-injected';

let activeAdapter = null;

export function init() {
  activeAdapter = ADAPTERS.find((a) => a.matches(location.href)) || null;
  if (!activeAdapter) return;

  injectAll();
  observe();

  // SPA renders order cards after load; retry briefly to cover the initial paint.
  let ticks = 0;
  const timer = setInterval(() => {
    injectAll();
    if (++ticks >= 10) clearInterval(timer);
  }, 700);
}

function injectAll(root = document) {
  if (!activeAdapter) return;
  for (const card of activeAdapter.findCards(root)) injectCard(card);
}

function injectCard(card) {
  if (!card || card.nodeType !== 1 || card.hasAttribute(MARK)) return;
  const mount = activeAdapter.getButtonMount(card);
  if (!mount) return;

  card.setAttribute(MARK, '1');

  const wrap = document.createElement('div');
  wrap.className = 'dps-stock-actions';
  wrap.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;';
  wrap.appendChild(makeButton('＋ Add Tool to Inventory', () => onCapture('tool', card)));
  wrap.appendChild(makeButton('＋ Add Part to Inventory', () => onCapture('part', card)));
  mount.appendChild(wrap);
}

function makeButton(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'dps-stock-btn';
  btn.style.cssText =
    'cursor:pointer;border:1px solid #d33;border-radius:16px;background:#fff;color:#d33;' +
    'font-size:12px;line-height:1;padding:8px 12px;font-weight:600;white-space:nowrap;';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#d33'; btn.style.color = '#fff'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; btn.style.color = '#d33'; });
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onClick();
  });
  return btn;
}

function observe() {
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // Re-scan any added subtree through the active adapter's findCards so
        // dynamically rendered cards get buttons regardless of store markup.
        if (node.querySelectorAll) injectAll(node);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

async function onCapture(kind, card) {
  const status = await send('getStatus');
  if (!status || !status.ok || !status.configured) {
    showToast('DPS Stock is not configured. Opening the options page…', 'error');
    send('openOptions');
    return;
  }

  const data = activeAdapter.extract(card);

  openDialog(kind, data, async (edited) => {
    showToast(`Saving ${kind}…`, 'info', { sticky: true, id: 'dps-saving' });
    const resp = await send(kind === 'tool' ? 'createTool' : 'createPart', edited);
    dismissToast('dps-saving');

    if (resp && resp.ok) {
      const warnings = resp.warnings || [];
      if (warnings.length) {
        showToast(`Created item #${resp.itemId}, with warnings: ${warnings.join(' · ')}`, 'warn');
      } else {
        showToast(`Created ${kind} #${resp.itemId} in DPS Stock ✓`, 'success');
      }
    } else {
      showToast(`Could not create ${kind}: ${(resp && resp.error) || 'unknown error'}`, 'error');
    }
  });
}

function send(type, data) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, data }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp);
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

function dismissToast(id) {
  document.dispatchEvent(new CustomEvent('dps-stock-dismiss-toast', { detail: { id } }));
}
