(() => {
  if (window.vsnMetafieldsInitialized) return;
  window.vsnMetafieldsInitialized = true;
  const controllers = new Map();
  const debounceTimers = new Map();
  function selection(event) {
    const form = event.target?.closest?.('form[action*="/cart/add"]');
    const product = event.detail?.product?.id || event.detail?.variant?.product_id || form?.dataset?.productId;
    // An explicit unavailable/invalid variant means no valid selection.
    // Never silently use the old form input or URL when the theme provides
    // a variant key but does not provide a usable numeric variant ID.
    if (event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'variant')) {
      const detailId = event.detail.variant?.id;
      if (!/^\d+$/.test(String(detailId ?? '')))
        return { variant: null, product };
    }
    const variant = event.detail?.variant?.id || form?.querySelector('[name="id"]')?.value || new URL(location.href).searchParams.get('variant');
    if (!/^\d+$/.test(String(variant || ''))) return null;
    return { variant: String(variant), product };
  }
  function eligibleBlocks(product) {
    return [...document.querySelectorAll('[data-vsn-source="variant"]')].filter(block => {
      // Theme form events apply only to the product page's own product, not product overrides.
      return block.dataset.vsnTrack === 'true' && (!product || String(product) === block.dataset.vsnProduct);
    });
  }
  async function refresh({ variant }, block) {
      // The block may have been detached by a theme-editor section swap.
      if (!block.isConnected || (block.dataset.vsnVariant === variant && !block.hidden)) return;
      const url = new URL(location.href);
      url.searchParams.set('variant', String(variant));
      url.searchParams.set('section_id', block.dataset.vsnSection);
      controllers.get(block.id)?.abort();
      const controller = new AbortController();
      controllers.set(block.id, controller);
      const timeout = setTimeout(() => controller.abort(), 8000);
      block.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw Error('Section unavailable');
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const next = page.getElementById(block.id);
        if (controllers.get(block.id) !== controller) return;
        if (next && next.dataset.vsnProduct === block.dataset.vsnProduct && next.dataset.vsnVariant === String(variant) && block.isConnected) {
          block.replaceWith(next);
        } else {
          block.hidden = true;
        }
      } catch {
        // Never keep another variant's stale value visible after a failed refresh.
        if (controllers.get(block.id) === controller && block.isConnected) block.hidden = true;
      } finally {
        clearTimeout(timeout);
        if (controllers.get(block.id) === controller) {
          controllers.delete(block.id);
          block.removeAttribute('aria-busy');
        }
      }
  }
  const schedule = event => {
    const next = selection(event);
    if (!next) return;
    const blocks = eligibleBlocks(next.product);
    if (!blocks.length) return;
    // A theme event with no product identity cannot safely select variants
    // across unrelated products. Preserve single-product theme compatibility.
    if (!next.product && new Set(blocks.map(block => block.dataset.vsnProduct)).size > 1) return;
    for (const block of blocks) {
      // Each block owns its debounce, so different product cards or forms
      // cannot cancel one another's pending variant refresh.
      clearTimeout(debounceTimers.get(block.id));
      // Invalidate at selection time, even when returning to the currently rendered variant.
      // An earlier response must not win during the debounce delay or clear a newer busy state.
      controllers.get(block.id)?.abort();
      controllers.delete(block.id);
      block.removeAttribute('aria-busy');
      if (next.variant === null) {
        block.hidden = true;
        debounceTimers.delete(block.id);
        continue;
      }
      if (block.dataset.vsnVariant !== next.variant) block.hidden = true;
      debounceTimers.set(block.id, setTimeout(() => {
        debounceTimers.delete(block.id);
        refresh(next, block);
      }, 80));
    }
  };
  document.addEventListener('change', event => { if (event.target.closest?.('form[action*="/cart/add"]')) schedule(event); });
  document.addEventListener('variant:change', schedule);
  document.addEventListener('product:variant-change', schedule);
})();
