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

		if (process.env.NODE_ENV !== "production") {
			console.log("SUBSCRIPTION JSON:", JSON.stringify(subscriptionJson, null, 2));
		}

		// GraphQL-level errors
		if (subscriptionJson?.errors) {
			const errMsg = Array.isArray(subscriptionJson.errors) ? subscriptionJson.errors[0]?.message : subscriptionJson.errors?.message;

			return Response.json(
				{ ok: false, hasActivePlan: false, error: errMsg || "GraphQL error" },
				{ status: 500 }
			);
		}

		const activeSubscriptions = subscriptionJson?.data?.currentAppInstallation?.activeSubscriptions ?? [];

		const validSubscriptions = process.env.NODE_ENV === "production" ? activeSubscriptions.filter((sub) => !sub.test) : activeSubscriptions;

		const hasActivePlan = validSubscriptions.some((sub) => sub.status === "ACTIVE");

		return {
			ok: true,
			shop: session.shop,
			hasActivePlan,
			subscriptions: validSubscriptions,
		};

	} catch (error) {
		if (error instanceof Response) {
			const body = await error.text().catch(() => "Could not read error body");

			console.error("SUBSCRIPTION RESPONSE STATUS:", error.status);
			console.error("SUBSCRIPTION RESPONSE BODY:", body);

			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error: `Subscription query failed with status ${error.status}`,
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