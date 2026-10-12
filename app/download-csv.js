export function downloadCsv(name, source, host = window) {
  const url = host.URL.createObjectURL(
    new host.Blob([source], { type: "text/csv;charset=utf-8" }),
  );
  const link = host.document.createElement("a");
  link.href = url;
  link.download = name;
  host.document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
    // The browser may read the Blob after the click handler returns.
    host.setTimeout(() => host.URL.revokeObjectURL(url), 60_000);
  }
}
