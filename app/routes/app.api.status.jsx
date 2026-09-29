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
  return process.env.APP_ENV === "production";
}

function getValidSubscriptions(subscriptions) {
  return isProductionBilling()
    ? subscriptions.filter((subscription) => !subscription.test)
    : subscriptions;
}


// ─── GET: fetch subscription status ───────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const activeSubscriptions = await getActiveSubscriptions(admin);
    const validSubscriptions = getValidSubscriptions(activeSubscriptions);
    const hasActivePlan = validSubscriptions.some(
      (subscription) => subscription.status === "ACTIVE"
    );

    return Response.json({
      ok: true,
      shop: session.shop,
      hasActivePlan,
      subscriptions: validSubscriptions,
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
  const { admin, session } = await authenticate.admin(request);

  if (request.method.toUpperCase() !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

	// ── CANCEL ──────────────────────────────────────────────────────────────────
	if (actionType === "cancel") {
		const id = formData.get("id");

		if (!id) {
			return Response.json({ ok: false, error: "Subscription ID is required." }, { status: 400 });
		}

    try {
      const validSubscriptions = getValidSubscriptions(
        await getActiveSubscriptions(admin)
      );
      const subscriptionToCancel = validSubscriptions.find(
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
      const validSubscriptions = getValidSubscriptions(
        await getActiveSubscriptions(admin)
      );
      const duplicateActivePlan = validSubscriptions.find(
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
						test: false
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

	return Response.json({ ok: false, error: "Unknown actionType." }, { status: 400 });
};