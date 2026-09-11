// Options page logic. Reads/writes settings directly (this is a privileged
// extension context) and delegates network calls to the service worker.

import {
  getSettings,
  saveSettings,
  normalizeBaseUrl,
  originPatternFor,
} from '../shared/settings.js';

const el = (id) => document.getElementById(id);
const backendUrl = el('backendUrl');
const apiKey = el('apiKey');
const toolTemplate = el('toolTemplate');
const partTemplate = el('partTemplate');
const status = el('status');

let loaded = { toolTemplateId: null, partTemplateId: null };

init();

async function init() {
  const s = await getSettings();
  backendUrl.value = s.backendUrl || '';
  apiKey.value = s.apiKey || '';
  loaded = { toolTemplateId: s.toolTemplateId, partTemplateId: s.partTemplateId };

  el('save').addEventListener('click', onSave);
  el('test').addEventListener('click', onTest);

  if (s.backendUrl && s.apiKey) loadTemplates();
}

function setStatus(kind, message) {
  status.className = kind; // 'ok' | 'err' | 'info'
  status.textContent = message;
}

function send(type, data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, data }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp);
    });
  });
}

async function onSave() {
  const url = normalizeBaseUrl(backendUrl.value);
  const key = apiKey.value.trim();
  if (!url) return setStatus('err', 'Backend base URL is required.');
  if (!key) return setStatus('err', 'API key is required.');

  // Request host permission for the configured origin (needs a user gesture).
  const pattern = originPatternFor(url);
  if (pattern) {
    try {
      const granted = await chrome.permissions.request({ origins: [pattern] });
      if (!granted) {
        setStatus('err', `Permission to access ${pattern} was denied. The extension cannot call the backend without it.`);
        return;
      }
    } catch (e) {
      setStatus('err', `Could not request host permission: ${e.message}`);
      return;
    }
  }

  await saveSettings({
    backendUrl: url,
    apiKey: key,
    toolTemplateId: toolTemplate.value || null,
    partTemplateId: partTemplate.value || null,
  });
  loaded = { toolTemplateId: toolTemplate.value || null, partTemplateId: partTemplate.value || null };

  setStatus('ok', 'Settings saved.');
  await loadTemplates();
}

async function onTest() {
  setStatus('info', 'Testing connection…');
  // Persist current URL/key first so the worker tests what is on screen.
  const url = normalizeBaseUrl(backendUrl.value);
  const key = apiKey.value.trim();
  if (!url || !key) return setStatus('err', 'Enter the backend URL and API key first.');
  await saveSettings({ backendUrl: url, apiKey: key });

  const resp = await send('testConnection');
  if (resp && resp.ok) setStatus('ok', resp.message || 'Connection OK.');
  else setStatus('err', (resp && resp.message) || (resp && resp.error) || 'Connection failed.');
}

async function loadTemplates() {
  const resp = await send('getTemplates');
  if (!resp || !resp.ok) {
    setStatus('err', `Could not load templates: ${(resp && resp.error) || 'unknown error'}`);
    return;
  }
  const templates = Array.isArray(resp.templates) ? resp.templates : [];
  const toolCapable = templates.filter((t) => (t.capabilities || []).includes('TOOL'));

  fillSelect(toolTemplate, toolCapable, loaded.toolTemplateId);
  fillSelect(partTemplate, templates, loaded.partTemplateId);
}

function fillSelect(select, templates, selectedId) {
  const selected = selectedId != null ? String(selectedId) : '';
  select.innerHTML = '<option value="">— none —</option>';
  for (const t of templates) {
    const opt = document.createElement('option');
    opt.value = String(t.id);
    opt.textContent = t.name || `Template #${t.id}`;
    if (String(t.id) === selected) opt.selected = true;
    select.appendChild(opt);
  }
}
