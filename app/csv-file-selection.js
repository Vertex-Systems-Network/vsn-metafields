export function createCsvFileSelection(maxBytes = 256000) {
  let revision = 0;

  return {
    invalidate() {
      revision += 1;
    },
    async read(file) {
      const current = ++revision;
      if (file.size > maxBytes) return { status: "oversized" };
      try {
        const csv = await file.text();
        return current === revision
          ? { status: "ready", csv }
          : { status: "stale" };
      } catch {
        return current === revision
          ? { status: "unreadable" }
          : { status: "stale" };
      }
    },
  };
}
