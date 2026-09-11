// Pre-filled confirmation dialog, rendered in a Shadow DOM so the host page's
// styles cannot break it and ours cannot leak out. Tool variant shows
// description + photo; Part variant adds supplier name, link, price, reference.

/**
 * @param {'tool'|'part'} kind
 * @param {object} data  CapturedItem from the store adapter
 * @param {(edited: object) => void} onConfirm  receives the edited fields
 */
export function openDialog(kind, data, onConfirm) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.appendChild(styleEl());

  const isPart = kind === 'part';
  const title = isPart ? 'Add Part to Inventory' : 'Add Tool to Inventory';

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <header><h2>${title}</h2><button class="x" title="Close" type="button">×</button></header>
      <div class="body">
        <label>Description
          <textarea name="description" rows="3"></textarea>
        </label>
        <div class="photo">
          <div class="thumb"><img alt="" /></div>
          <label class="grow">Photo URL
            <input name="imageUrl" type="url" />
          </label>
        </div>
        <div class="part-only">
          <label>Supplier name
            <input name="supplierName" type="text" />
          </label>
          <label>Supplier link
            <input name="link" type="url" />
          </label>
          <div class="row">
            <label class="grow">Price
              <input name="price" type="number" step="0.01" min="0" inputmode="decimal" />
            </label>
            <label class="grow">Reference
              <input name="reference" type="text" />
            </label>
          </div>
        </div>
      </div>
      <footer>
        <button class="cancel" type="button">Cancel</button>
        <button class="confirm" type="button">Save to DPS Stock</button>
      </footer>
    </div>`;
  root.appendChild(overlay);

  if (!isPart) overlay.querySelector('.part-only').style.display = 'none';

  const $ = (sel) => overlay.querySelector(sel);
  const field = (name) => overlay.querySelector(`[name="${name}"]`);

  field('description').value = data.description || '';
  field('imageUrl').value = data.imageUrl || '';
  const img = $('.thumb img');
  const syncThumb = () => {
    const url = field('imageUrl').value.trim();
    if (url) { img.src = url; img.style.display = 'block'; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  };
  field('imageUrl').addEventListener('input', syncThumb);
  syncThumb();

  if (isPart) {
    field('supplierName').value = data.supplierName || '';
    field('link').value = data.productLink || '';
    field('price').value = data.price != null ? String(data.price) : '';
    field('reference').value = data.reference || '';
  }

  const close = () => host.remove();
  $('.x').addEventListener('click', close);
  $('.cancel').addEventListener('click', close);
  overlay.addEventListener('mousedown', (ev) => { if (ev.target === overlay) close(); });
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });

  $('.confirm').addEventListener('click', () => {
    const description = field('description').value.trim();
    if (!description) {
      field('description').focus();
      field('description').style.borderColor = '#b91c1c';
      return;
    }
    const edited = { description, imageUrl: field('imageUrl').value.trim() };
    if (isPart) {
      const priceRaw = field('price').value.trim();
      const priceNum = priceRaw === '' ? null : Number(priceRaw);
      edited.supplierName = field('supplierName').value.trim();
      edited.link = field('link').value.trim();
      edited.price = Number.isFinite(priceNum) ? priceNum : null;
      edited.reference = field('reference').value.trim();
    }
    close();
    onConfirm(edited);
  });

  document.documentElement.appendChild(host);
  field('description').focus();
}

function styleEl() {
  const s = document.createElement('style');
  s.textContent = `
    * { box-sizing: border-box; font-family: system-ui, sans-serif; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45);
               display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: #fff; color: #1f2937; width: 520px; max-width: 100%;
             max-height: 90vh; overflow: auto; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    header { display: flex; align-items: center; justify-content: space-between;
             padding: 16px 18px; border-bottom: 1px solid #eee; }
    h2 { margin: 0; font-size: 16px; }
    .x { border: none; background: none; font-size: 22px; line-height: 1; cursor: pointer; color: #6b7280; }
    .body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #374151; }
    input, textarea { font-size: 13px; font-weight: 400; padding: 8px 10px; border: 1px solid #d1d5db;
                      border-radius: 8px; width: 100%; resize: vertical; }
    .photo { display: flex; gap: 12px; align-items: flex-start; }
    .thumb { width: 72px; height: 72px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
             flex: 0 0 auto; background: #f9fafb; display: flex; align-items: center; justify-content: center; }
    .thumb img { width: 100%; height: 100%; object-fit: contain; display: none; }
    .grow { flex: 1 1 auto; }
    .part-only { display: flex; flex-direction: column; gap: 12px; }
    .row { display: flex; gap: 12px; }
    footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 18px; border-top: 1px solid #eee; }
    footer button { cursor: pointer; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 600; }
    .cancel { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .confirm { background: #d33; border: 1px solid #d33; color: #fff; }
  `;
  return s;
}
