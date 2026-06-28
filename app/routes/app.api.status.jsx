import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	const { admin, session } = await authenticate.admin(request);

	console.log("STATUS API AUTH OK");
	console.log("STATUS API SHOP:", session.shop);
	console.log("STATUS API SCOPE:", session.scope);

	try {
		const subscriptionRes = await admin.graphql(`
      #graphql
      query GetSubscriptionStatus {
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

		const subscriptionJson = await subscriptionRes.json();

		console.log(
			"SUBSCRIPTION JSON:",
			JSON.stringify(subscriptionJson, null, 2)
		);

		if (subscriptionJson?.errors?.length) {
			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error:
						subscriptionJson.errors[0]?.message ||
						"Subscription GraphQL error.",
					details: subscriptionJson.errors,
				},
				{ status: 500 }
			);
		}

		const activeSubscriptions =
			subscriptionJson?.data?.currentAppInstallation?.activeSubscriptions || [];

		// During testing, allow test subscriptions.
		// In real production, you can filter test subscriptions if needed.
		const validSubscriptions =
			process.env.NODE_ENV === "production"
				? activeSubscriptions.filter((sub) => !sub.test)
				: activeSubscriptions;

		const hasActivePlan = validSubscriptions.some(
			(sub) => sub.status === "ACTIVE"
		);

		return Response.json({
			ok: true,
			shop: session.shop,
			hasActivePlan,
			subscriptions: validSubscriptions,
		});
	} catch (error) {
		if (error instanceof Response) {
			const body = await error.clone().text();

			console.error("SUBSCRIPTION RESPONSE STATUS:", error.status);
			console.error("SUBSCRIPTION RESPONSE BODY:", body);

			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error: `Subscription query failed with ${error.status}`,
					body,
				},
				{ status: error.status }
			);
		}

		console.error("SUBSCRIPTION QUERY FAILED:", error);

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