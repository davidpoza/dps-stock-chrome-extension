// Settings persistence for the DPS Stock extension.
// Stored in chrome.storage.local so the API key never roams to Google's sync
// servers and is never exposed to the visited page's JavaScript context.

export const DEFAULT_SETTINGS = {
  backendUrl: '',
  apiKey: '',
  toolTemplateId: null,
  partTemplateId: null,
};

/** Read all settings, merged over defaults. */
export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored, backendUrl: normalizeBaseUrl(stored.backendUrl) };
}

/** Persist a partial patch of settings and return the merged result. */
export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  next.backendUrl = normalizeBaseUrl(next.backendUrl);
  await chrome.storage.local.set(next);
  return next;
}

/** True when both a backend URL and an API key are present. */
export function isConfigured(settings) {
  return Boolean(settings && settings.backendUrl && settings.apiKey);
}

/** Trim trailing slashes so paths can be concatenated safely. */
export function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** Build an origin match pattern (e.g. "https://host/*") for permission requests. */
export function originPatternFor(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}
