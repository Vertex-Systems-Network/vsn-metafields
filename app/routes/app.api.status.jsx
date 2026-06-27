import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);

    console.log("STATUS API AUTH OK");
    console.log("Shop:", session.shop);
    console.log("Scope:", session.scope);

    return Response.json({
      ok: true,
      shop: session.shop,
      hasActivePlan: true,
      subscriptions: [],
    });
  } catch (error) {
    console.error("STATUS API AUTH FAILED:", error);

    return Response.json(
      {
        ok: false,
        hasActivePlan: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
};