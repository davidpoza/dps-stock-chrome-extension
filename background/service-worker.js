// Background service worker: the only context that reads the API key and talks
// to the DPS Stock backend. Content script and options page interact with it
// through chrome.runtime messages.

import { getSettings, isConfigured } from '../shared/settings.js';
import { createClient, ApiError } from '../shared/api.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e && e.message ? e.message : String(e) }));
  return true; // keep the message channel open for the async response
});

async function handle(msg) {
  switch (msg && msg.type) {
    case 'getStatus':
      return getStatus();
    case 'testConnection':
      return testConnection();
    case 'getTemplates':
      return getTemplates();
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      return { ok: true };
    case 'createTool':
      return createTool(msg.data || {});
    case 'createPart':
      return createPart(msg.data || {});
    default:
      return { ok: false, error: `Unknown message type: ${msg && msg.type}` };
  }
}

/** Lightweight status for the content script (never returns the key). */
async function getStatus() {
  const s = await getSettings();
  return {
    ok: true,
    configured: isConfigured(s),
    hasToolTemplate: Boolean(s.toolTemplateId),
    hasPartTemplate: Boolean(s.partTemplateId),
  };
}

async function testConnection() {
  const s = await getSettings();
  if (!isConfigured(s)) {
    return { ok: false, reason: 'not-configured', message: 'Set the backend URL and API key first.' };
  }
  const client = createClient(s);
  try {
    await client.getTemplates();
    return { ok: true, message: 'Connection OK. Note: creating items requires an ADMIN-scoped key.' };
  } catch (e) {
    const reason = e instanceof ApiError ? e.kind : 'http';
    return { ok: false, reason, message: e.message };
  }
}

async function getTemplates() {
  const s = await getSettings();
  if (!isConfigured(s)) return { ok: false, error: 'Not configured' };
  const client = createClient(s);
  try {
    return { ok: true, templates: await client.getTemplates() };
  } catch (e) {
    return { ok: false, error: e.message, auth: e instanceof ApiError && e.kind === 'auth' };
  }
}

async function createTool(data) {
  const s = await getSettings();
  if (!isConfigured(s)) return { ok: false, error: 'Not configured. Open Options and set the backend URL and API key.' };
  if (!s.toolTemplateId) {
    return { ok: false, error: 'No default Tool template configured. Open Options and select one.' };
  }
  const client = createClient(s);
  const warnings = [];
  let item;
  try {
    item = await client.createItem({ description: data.description, templateId: Number(s.toolTemplateId) });
  } catch (e) {
    return failure(e);
  }
  await attachPhoto(client, item.id, data.imageUrl, warnings);
  return { ok: true, itemId: item.id, kind: 'tool', warnings };
}

async function createPart(data) {
  const s = await getSettings();
  if (!isConfigured(s)) return { ok: false, error: 'Not configured. Open Options and set the backend URL and API key.' };
  const client = createClient(s);
  const warnings = [];

  const payload = { description: data.description };
  if (s.partTemplateId) payload.templateId = Number(s.partTemplateId);

  let item;
  try {
    item = await client.createItem(payload);
  } catch (e) {
    return failure(e);
  }

  await attachPhoto(client, item.id, data.imageUrl, warnings);

  const supplierName = data.supplierName || 'AliExpress';
  if (data.link || data.supplierName) {
    try {
      await client.createSupplier({ description: supplierName, link: data.link || '', itemId: item.id });
    } catch (e) {
      warnings.push(`Supplier not saved: ${e.message}`);
    }
  }

  if (data.link || data.price != null || data.reference) {
    try {
      await client.addBuyingLink(item.id, {
        link: data.link || '',
        price: data.price ?? null,
        supplierReference: data.reference || '',
        description: supplierName,
      });
    } catch (e) {
      warnings.push(`Buying link not saved: ${e.message}`);
    }
  }

  return { ok: true, itemId: item.id, kind: 'part', warnings };
}

// Download the image in the worker (host permission covers the CDN) and upload
// it to the item. Photo failure is non-fatal: it becomes a warning so the
// created item is kept and reported as partial success.
async function attachPhoto(client, itemId, imageUrl, warnings) {
  if (!imageUrl) {
    warnings.push('No image was captured, so no photo was attached.');
    return;
  }
  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    await client.uploadPhoto(itemId, blob, filenameFor(imageUrl, blob.type));
  } catch (e) {
    warnings.push(`Photo not uploaded: ${e.message}`);
  }
}

function filenameFor(url, mime) {
  const ext = (mime && mime.split('/')[1]) || 'jpg';
  let base = 'photo';
  try {
    const path = new URL(url).pathname;
    base = path.substring(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '') || 'photo';
  } catch { /* keep default */ }
  return `${base}.${ext}`;
}

function failure(e) {
  const auth = e instanceof ApiError && e.kind === 'auth';
  return { ok: false, error: e && e.message ? e.message : String(e), auth };
}
