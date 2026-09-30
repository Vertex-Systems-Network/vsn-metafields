import { authenticate } from "../shopify.server";
import { PRO_PLAN } from "../billing-config";

async function getActiveSubscriptions(admin) {
  const response = await admin.graphql(`
    #graphql
    query GetActiveSubscriptions {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          test
          currentPeriodEnd
          trialDays
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppRecurringPricing {
                  price {
                    amount
                    currencyCode
                  }
                  interval
                }
                ... on AppUsagePricing {
                  cappedAmount {
                    amount
                    currencyCode
                  }
                  terms
                }
              }
            }
          }
        }
      }
    }
  `);

  const json = await response.json();

  if (json?.errors?.length) {
    throw new Error(json.errors[0]?.message || "Subscription query failed.");
  }

  return json?.data?.currentAppInstallation?.activeSubscriptions ?? [];
}

function isProductionBilling() {
  return (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

// ─── GET: fetch subscription status ───────────────────────────────────────────
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  console.info("[vsn-status-loader]", JSON.stringify({
    method: request.method,
    pathname: url.pathname,
    hasShop: url.searchParams.has("shop"),
    hasHost: url.searchParams.has("host"),
    hasIdToken: url.searchParams.has("id_token"),
  }));

  let auth;
  try {
    auth = await authenticate.admin(request);
  } catch (error) {
    console.error("[vsn-status-loader-auth-failed]", JSON.stringify({
      method: request.method,
      pathname: url.pathname,
      status: error instanceof Response ? error.status : undefined,
      statusText: error instanceof Response ? error.statusText : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : undefined,
    }));
    throw error;
  }

  const { admin, session } = auth;

  try {
    const activeSubscriptions = await getActiveSubscriptions(admin);
    // Shopify's test flag describes how the subscription is billed, not whether
    // an already-active subscription grants app access. Existing demo/test-store
    // subscriptions must stay valid after a production hosting migration.
    const hasActivePlan = activeSubscriptions.some(
      (subscription) => subscription.status === "ACTIVE"
    );

    return Response.json({
      ok: true,
      shop: session.shop,
      hasActivePlan,
      subscriptions: activeSubscriptions,
    });
  } catch (error) {
    if (error instanceof Response) {
      return Response.json(
        {
          ok: false,
          hasActivePlan: false,
          error: `Subscription query failed with status ${error.status}`,
        },
        { status: error.status }
      );
    }

    return Response.json(
      {
        ok: false,
        hasActivePlan: false,
        error: error?.message || "Subscription query failed.",
      },
      { status: 500 }
    );
  }
};

// ─── POST: create or cancel subscription ──────────────────────────────────────
export const action = async ({ request }) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  console.info("[vsn-status-action]", JSON.stringify({
    method,
    pathname: url.pathname,
    actionType: String(actionType || ""),
    hasShop: url.searchParams.has("shop"),
    hasHost: url.searchParams.has("host"),
    hasIdToken: url.searchParams.has("id_token"),
  }));

  if (actionType !== "create" && actionType !== "cancel") {
    return Response.json(
      { ok: false, error: "Unsupported billing action." },
      { status: 400 }
    );
  }

  let auth;
  try {
    auth = await authenticate.admin(request);
  } catch (error) {
    console.error("[vsn-status-action-auth-failed]", JSON.stringify({
      method,
      pathname: url.pathname,
      actionType: String(actionType || ""),
      status: error instanceof Response ? error.status : undefined,
      statusText: error instanceof Response ? error.statusText : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : undefined,
    }));
    throw error;
  }

  const { admin, session } = auth;

	// ── CANCEL ──────────────────────────────────────────────────────────────────
	if (actionType === "cancel") {
		const id = formData.get("id");

		if (!id) {
			return Response.json({ ok: false, error: "Subscription ID is required." }, { status: 400 });
		}

    try {
      const activeSubscriptions = await getActiveSubscriptions(admin);
      const subscriptionToCancel = activeSubscriptions.find(
        (subscription) =>
          subscription.id === id && subscription.status === "ACTIVE"
      );

      if (!subscriptionToCancel) {
        return Response.json(
          { ok: false, error: "Active subscription not found." },
          { status: 404 }
        );
      }

			const res = await admin.graphql(
				`#graphql
				mutation CancelSubscription($id: ID!) {
					appSubscriptionCancel(id: $id, prorate: true) {
						userErrors {
							field
							message
						}
						appSubscription {
							id
							status
						}
					}
				}`,
				{ variables: { id } }   // ✅ safe — no string interpolation
			);

			const data = await res.json();
			const errors = data?.data?.appSubscriptionCancel?.userErrors ?? [];

			if (errors.length > 0) {
				return Response.json({ ok: false, error: errors[0].message }, { status: 400 });
			}

			return Response.json({
				ok: true,
				cancelled: true,
				subscription: data?.data?.appSubscriptionCancel?.appSubscription,
			});

		} catch (error) {
			//console.error("CANCEL ERROR:", error);
			return Response.json({ ok: false, error: "Failed to cancel subscription." }, { status: 500 });
		}
	}

	// ── CREATE ──────────────────────────────────────────────────────────────────
	if (actionType === "create") {
		const plan = formData.get("plan") || "pro-plan";

    const host = String(formData.get("host") || "");
    const shop = session.shop;
    const appUrl = process.env.SHOPIFY_APP_URL;

    if (!appUrl) {
      return Response.json(
        { ok: false, error: "Shopify app URL is not configured." },
        { status: 500 }
      );
    }

    const returnUrlObject = new URL("/app", appUrl);
    returnUrlObject.searchParams.set("shop", shop);
    if (host) {
      returnUrlObject.searchParams.set("host", host);
    }
    const returnUrl = returnUrlObject.toString();

		const planConfig = {
			[PRO_PLAN.id]: PRO_PLAN,
		};

		const selectedPlan = planConfig[plan];

		if (!selectedPlan) {
			return Response.json({ ok: false, error: `Unknown plan: ${plan}` }, { status: 400 });
		}

    try {
      const activeSubscriptions = await getActiveSubscriptions(admin);
      const duplicateActivePlan = activeSubscriptions.find(
        (subscription) =>
          subscription.status === "ACTIVE" &&
          subscription.name === selectedPlan.name
      );

      if (duplicateActivePlan) {
        return Response.json(
          {
            ok: false,
            error: "This plan is already active for the current shop.",
          },
          { status: 409 }
        );
      }

			const res = await admin.graphql(
				`#graphql
					mutation CreateSubscription(
					$name: String!
					$returnUrl: URL!
					$trialDays: Int
          $test: Boolean!
					$lineItems: [AppSubscriptionLineItemInput!]!
					) {
					appSubscriptionCreate(
						name: $name
						returnUrl: $returnUrl
						test: $test
						trialDays: $trialDays
						lineItems: $lineItems
					) {
						confirmationUrl
						appSubscription {
						id
						status
						}
						userErrors {
						field
						message
						}
					}
					}`,
				{
					variables: {
						name: selectedPlan.name,
						returnUrl,
						trialDays: selectedPlan.trialDays,
            test: !isProductionBilling(),
						lineItems: [
							{
								plan: {
									appRecurringPricingDetails: {
										price: {
											amount: selectedPlan.amount,
											currencyCode: selectedPlan.currencyCode,
										},
										interval: selectedPlan.interval,
									},
								},
							},
						],
					},
				}
			);

			const data = await res.json();
			const errors = data?.data?.appSubscriptionCreate?.userErrors ?? [];

			if (errors.length > 0) {
				return Response.json({ ok: false, error: errors[0].message }, { status: 400 });
			}

			const confirmationUrl = data?.data?.appSubscriptionCreate?.confirmationUrl;

			if (!confirmationUrl) {
				return Response.json(
					{ ok: false, error: "No confirmation URL returned from Shopify." },
					{ status: 500 }
				);
			}

			return Response.json({ ok: true, confirmationUrl });

		} catch (error) {
			//console.error("CREATE SUBSCRIPTION ERROR:", error);
			return Response.json({ ok: false, error: "Failed to create subscription." }, { status: 500 });
		}
	}

  return Response.json({ ok: false, error: "Unsupported billing action." }, { status: 400 });
};