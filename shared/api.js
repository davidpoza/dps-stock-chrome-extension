// Thin REST client for the DPS Stock backend.
// All calls run in the background service worker so the API key stays out of
// the page context and page-origin CORS is bypassed via host permissions.

/** Error carrying a machine-readable kind: 'network' | 'auth' | 'http'. */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

async function request(base, apiKey, path, { method = 'GET', body, isForm = false } = {}) {
  const url = base + path;
  const headers = { 'X-API-Key': apiKey };
  let payload = body;
  if (!isForm && body != null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError(`Could not reach the backend at ${url}: ${e.message}`, { kind: 'network' });
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(
      `Authorization failed (HTTP ${res.status}). The API key is invalid or lacks the required role ` +
        `(creating items and buying links needs an ADMIN-scoped key).`,
      { status: res.status, kind: 'auth' },
    );
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 500); } catch { /* ignore */ }
    throw new ApiError(`${method} ${path} failed (HTTP ${res.status}) ${detail}`.trim(), { status: res.status });
  }
  return res;
}

async function readJson(res) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Create a client bound to the given settings. */
export function createClient({ backendUrl, apiKey }) {
  const base = backendUrl;
  return {
    /** GET /item-templates -> ItemTemplateDTO[] */
    async getTemplates() {
      return readJson(await request(base, apiKey, '/item-templates'));
    },

    /** POST /items -> ItemDTO (with id). */
    async createItem(payload) {
      return readJson(await request(base, apiKey, '/items', { method: 'POST', body: payload }));
    },

    /** POST /items/{id}/upload (multipart) with type=PHOTO. */
    async uploadPhoto(itemId, blob, filename = 'photo.jpg') {
      const form = new FormData();
      form.append('file', blob, filename);
      form.append('type', 'PHOTO');
      await request(base, apiKey, `/items/${itemId}/upload`, { method: 'POST', body: form, isForm: true });
      return true;
    },

    /** POST /suppliers -> SupplierDTO. */
    async createSupplier({ description, link, itemId }) {
      return readJson(await request(base, apiKey, '/suppliers', { method: 'POST', body: { description, link, itemId } }));
    },

    /** POST /items/{id}/buying-links (204). */
    async addBuyingLink(itemId, { link, price, supplierReference, description }) {
      await request(base, apiKey, `/items/${itemId}/buying-links`, {
        method: 'POST',
        body: { link, price, supplierReference, description },
      });
      return true;
    },
  };
}
