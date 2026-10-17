export function downloadCsv(name, source, host = window) {
  const url = host.URL.createObjectURL(
    new host.Blob([source], { type: "text/csv;charset=utf-8" }),
  );
  let link;
  try {
    link = host.document.createElement("a");
    link.href = url;
    link.download = name;
    host.document.body.append(link);
    link.click();
  } finally {
    // A blocked embedded-app document or click may throw before the anchor is
    // inserted. Either way, the temporary element and Blob URL must be freed.
    try {
      link?.remove();
    } finally {
      try {
        // Browsers can read the Blob after the click handler has returned.
        host.setTimeout(() => host.URL.revokeObjectURL(url), 60_000);
      } catch {
        // A failed timer registration must not leave an unbounded Blob URL leak.
        host.URL.revokeObjectURL(url);
      }
    }
  }
}
