import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  await authenticate.webhook(request);
  // Bulk accepts product, variant and collection values only. Merchant-provided
  // text can still contain personal information; see the privacy review notes.
  return new Response();
};
