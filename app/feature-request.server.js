export function featureJson(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function boundedJson(request, maxBytes = 256000) {
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError("Request body is required.");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RangeError("Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = new TextDecoder().decode(bytes);
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    throw new RangeError("Enter valid JSON.");
  }
  if (!input || Array.isArray(input) || typeof input !== "object")
    throw new RangeError("Invalid request.");
  return input;
}
export function featureError(error) {
  return featureJson(
    {
      ok: false,
      error: String(
        error.message || "Shopify request failed. Retry or open diagnostics.",
      ).slice(0, 500),
    },
    error instanceof RangeError ? 400 : 502,
  );
}
