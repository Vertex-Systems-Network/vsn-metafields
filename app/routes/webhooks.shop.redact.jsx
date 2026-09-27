import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  await authenticate.webhook(request);
  // Shop-scoped session cleanup is handled by the authenticated uninstall webhook.
  return new Response();
};
