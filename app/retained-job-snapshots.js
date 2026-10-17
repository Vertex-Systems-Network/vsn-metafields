// Retained CSV preview/result JSON can include legacy or interrupted snapshots.
// Parsing is deliberately fail-closed for privacy review and GDPR redaction:
// a malformed snapshot cannot prove that it contains no personal information.
export function parseRetainedJobRows(job) {
  try {
    const rows = JSON.parse(job.rowsJson);
    const results = JSON.parse(job.resultsJson);
    if (!Array.isArray(rows) || !Array.isArray(results)) return null;
    const combined = [...rows, ...results];
    if (combined.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
      return null;
    return combined;
  } catch {
    return null;
  }
}
