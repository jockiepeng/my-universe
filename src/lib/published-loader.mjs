/**
 * Exclude drafts before Astro generates its content asset imports, not just routes.
 * @param {import('astro/loaders').Loader} loader
 * @param {boolean} includeDrafts
 * @returns {import('astro/loaders').Loader}
 */
export function publishedLoader(loader, includeDrafts) {
  return {
    ...loader,
    name: `published-${loader.name}`,
    async load(context) {
      await loader.load(context);
      if (!includeDrafts) {
        for (const [id, entry] of context.store.entries()) {
          if (entry.data.draft) context.store.delete(id);
        }
      }
    },
  };
}
