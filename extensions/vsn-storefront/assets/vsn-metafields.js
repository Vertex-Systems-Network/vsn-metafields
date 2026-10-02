(() => {
  if (window.vsnMetafieldsInitialized) return;
  window.vsnMetafieldsInitialized = true;
  const controllers = new Map();
  let timer;
  async function refresh(event) {
    const form = event.target?.closest?.('form[action*="/cart/add"]');
    const variant = event.detail?.variant?.id || form?.querySelector('[name="id"]')?.value || new URL(location.href).searchParams.get('variant');
    if (!/^\d+$/.test(String(variant || ''))) return;
    for (const block of document.querySelectorAll('[data-vsn-source="variant"]')) {
      // Theme form events apply only to the product page's own product, not product overrides.
      if (block.dataset.vsnTrack !== 'true') continue;
      const product = event.detail?.product?.id || event.detail?.variant?.product_id;
      if (product && String(product) !== block.dataset.vsnProduct) continue;
      if (block.dataset.vsnVariant === String(variant)) continue;
      const url = new URL(location.href);
      url.searchParams.set('variant', String(variant));
      url.searchParams.set('section_id', block.dataset.vsnSection);
      controllers.get(block.id)?.abort();
      const controller = new AbortController();
      controllers.set(block.id, controller);
      block.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw Error('Section unavailable');
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const next = page.getElementById(block.id);
        if (controllers.get(block.id) !== controller) continue;
        if (next && next.dataset.vsnProduct === block.dataset.vsnProduct && next.dataset.vsnVariant === String(variant) && block.isConnected) {
          block.replaceWith(next);
        } else {
          block.hidden = true;
        }
      } catch (error) {
        // Never keep another variant's stale value visible after a failed refresh.
        if (error.name !== 'AbortError' && controllers.get(block.id) === controller && block.isConnected) block.hidden = true;
      } finally { if (controllers.get(block.id) === controller) controllers.delete(block.id); block.removeAttribute('aria-busy'); }
    }
  }
  const schedule = event => { clearTimeout(timer); timer = setTimeout(() => refresh(event), 80); };
  document.addEventListener('change', event => { if (event.target.closest?.('form[action*="/cart/add"]')) schedule(event); });
  document.addEventListener('variant:change', schedule);
  document.addEventListener('product:variant-change', schedule);
})();
