export const CSV_HEADER = [
  "ownerType",
  "ownerId",
  "namespace",
  "key",
  "type",
  "value_json",
];
export function parseImportCsv(source) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > 256000
  )
    throw new RangeError("CSV must be under 256 KB.");
  source = source.replace(/^\uFEFF/, "");
  const rows = [],
    row = [];
  let cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new RangeError("Malformed CSV quote.");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push([...row]);
      row.length = 0;
      cell = "";
      closed = false;
      if (rows.length > 101)
        throw new RangeError("Import is limited to 100 rows per job.");
    } else {
      if (closed) throw new RangeError("Unexpected data after CSV quote.");
      cell += c;
    }
  }
  if (quoted) throw new RangeError("CSV quote was not closed.");
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  const header = rows.shift();
  if (
    JSON.stringify(header) !== JSON.stringify(CSV_HEADER) ||
    !rows.length ||
    rows.length > 100
  )
    throw new RangeError("Use the supplied CSV header and 1–100 rows.");
  return rows.map((values, index) => {
    if (values.length !== CSV_HEADER.length)
      return {
        row: index + 2,
        parseError: "CSV column count does not match the header.",
      };
    const item = Object.fromEntries(
      CSV_HEADER.map((key, i) => [key, values[i]]),
    );
    try {
      const value = JSON.parse(item.value_json);
      if (typeof value !== "string") throw new Error();
      return { ...item, row: index + 2, value };
    } catch {
      return {
        ...item,
        row: index + 2,
        parseError: "value_json must contain a JSON-encoded string.",
      };
    }
  });
}
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
export function exportValueCsv(rows) {
  // JSON-encoded value avoids spreadsheet formula execution and loss of false/zero/newlines.
  return (
    [
      CSV_HEADER.join(","),
      ...rows.map((r) =>
        [
          r.ownerType,
          r.ownerId,
          r.namespace,
          r.key,
          r.type,
          JSON.stringify(r.value ?? ""),
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
