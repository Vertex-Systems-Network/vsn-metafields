const numericId = (value) => /^\d+$/.test(String(value ?? "")) ? String(value) : "";
const thirtyDays = 30 * 24 * 60 * 60 * 1000;

// Shopify CLI's signed sample may have a placeholder shop_domain.
// Acknowledge a test-only mismatch without creating a merchant request.
export function isSyntheticShopMismatch(shop, payload, testHeader) {
  return testHeader === "true" && Boolean(shop) && payload?.shop_domain !== shop;
}

export function parseDataRequest(shop, payload) {
  if (!shop || payload?.shop_domain !== shop) throw new RangeError("Shop mismatch.");
  const requestId = numericId(payload?.data_request?.id);
  if (!requestId) throw new RangeError("Missing data request ID.");
  const customerId = numericId(payload?.customer?.id) || null;
  const email = String(payload?.customer?.email ?? "").trim().toLowerCase();
  const phone = String(payload?.customer?.phone ?? "").trim();
  if (email.length > 254 || phone.length > 32) throw new RangeError("Identifier too long.");
  const orders = payload?.orders_requested ?? [];
  if (!Array.isArray(orders) || orders.length > 1000 || orders.some((id) => !numericId(id)))
    throw new RangeError("Invalid order IDs.");
  return {
    id: `${shop}:${requestId}`,
    shop,
    customerId,
    customerEmail: email || null,
    customerPhone: phone || null,
    ordersJson: JSON.stringify(orders.map(String)),
  };
}

export async function recordDataRequest(db, shop, payload) {
  const data = parseDataRequest(shop, payload);
  // A duplicate delivery cannot reopen an already completed request.
  return db.privacyRequest.upsert({
    where: { id: data.id },
    create: data,
    update: {},
  });
}

export function matchingJobIds(request, jobs) {
  const customerGid = request.customerId ? `gid://shopify/Customer/${request.customerId}` : null;
  const orderGids = new Set(JSON.parse(request.ordersJson).map((id) => `gid://shopify/Order/${id}`));
  const email = request.customerEmail?.toLowerCase();
  const phone = request.customerPhone;
  return jobs.filter((job) => {
    const rows = [...JSON.parse(job.rowsJson), ...JSON.parse(job.resultsJson)];
    return rows.some((row) => {
      const text = JSON.stringify(row).toLowerCase();
      return (customerGid && row.ownerType === "CUSTOMER" && row.ownerId === customerGid) ||
        (row.ownerType === "ORDER" && orderGids.has(row.ownerId)) ||
        (email && text.includes(email)) ||
        (phone && text.includes(phone.toLowerCase()));
    });
  }).map((job) => job.id);
}

export async function listDataRequests(db, shop) {
  const [requests, jobs] = await Promise.all([
    db.privacyRequest.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.metafieldJob.findMany({
      where: { shop, expiresAt: { gt: new Date() } },
      select: { id: true, rowsJson: true, resultsJson: true },
      take: 20,
    }),
  ]);
  return requests.map((request) => ({
    id: request.id,
    customerId: request.customerId,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    orders: JSON.parse(request.ordersJson),
    status: request.status,
    createdAt: request.createdAt,
    completedAt: request.completedAt,
    candidateJobIds: matchingJobIds(request, jobs),
    allJobIds: jobs.map((job) => job.id),
  }));
}

export async function completeDataRequest(db, shop, id, confirmation) {
  if (confirmation !== `FULFILLED:${id}`) throw new RangeError("Explicit fulfillment confirmation required.");
  const result = await db.privacyRequest.updateMany({
    where: { id, shop, status: "pending" },
    data: { status: "fulfilled", completedAt: new Date(), customerId: null, customerEmail: null, customerPhone: null, ordersJson: "[]" },
  });
  if (result.count !== 1) throw new RangeError("Request was already fulfilled or not found.");
}

export async function purgeCompletedRequests(db, now = new Date()) {
  const result = await db.privacyRequest.deleteMany({
    where: { status: "fulfilled", completedAt: { lte: new Date(now.getTime() - thirtyDays) } },
  });
  return result.count;
}
