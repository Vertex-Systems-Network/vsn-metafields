import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  await authenticate.webhook(request);
  // The app currently stores no customer payload data.
  return new Response();
};
