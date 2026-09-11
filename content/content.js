// Classic content-script loader.
//
// Manifest-declared content scripts cannot themselves be ES modules, so this
// tiny loader dynamically imports the real (module) entrypoint from an
// extension URL. main.js and everything it imports are listed under
// web_accessible_resources in the manifest.

(async () => {
  try {
    const mod = await import(chrome.runtime.getURL('content/main.js'));
    mod.init();
  } catch (e) {
    console.error('[DPS Stock] failed to initialize content script', e);
  }
})();
