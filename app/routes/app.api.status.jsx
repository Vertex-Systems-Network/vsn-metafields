import { ActionFunctionArgs, LoaderFunction, ActionFunction } from 'react-router';
import { authenticate } from "../shopify.server";

// ─── GET: fetch subscription status ───────────────────────────────────────────
export const loader: LoaderFunction = async ({ request }: ActionFunctionArgs) => {
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

		if (subscriptionJson?.errors) {
			const errMsg = Array.isArray(subscriptionJson.errors)
				? subscriptionJson.errors[0]?.message
				: subscriptionJson.errors?.message;

			return Response.json(
				{ ok: false, hasActivePlan: false, error: errMsg || "GraphQL error" },
				{ status: 500 }
			);
		}

		const activeSubscriptions =
			subscriptionJson?.data?.currentAppInstallation?.activeSubscriptions ?? [];

		// In dev, include test subscriptions; in prod, exclude them
		const validSubscriptions =
			process.env.NODE_ENV === "production"
				? activeSubscriptions.filter((sub) => !sub.test)
				: activeSubscriptions;

		const hasActivePlan = validSubscriptions.some((sub) => sub.status === "ACTIVE");

		return Response.json({
			ok: true,
			shop: session.shop,
			hasActivePlan,
			subscriptions: validSubscriptions,
		});

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

// ─── POST: create or cancel subscription ──────────────────────────────────────
export const action: ActionFunction = async ({ request }: ActionFunctionArgs) => {
	const { admin, session } = await authenticate.admin(request);
	const formData = await request.formData();
	const actionType = formData.get("actionType");

	// ── CANCEL ──────────────────────────────────────────────────────────────────
	if (actionType === "cancel") {
		const id = formData.get("id");

		if (!id) {
			return Response.json({ ok: false, error: "Subscription ID is required." }, { status: 400 });
		}

		try {
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
			console.error("CANCEL ERROR:", error);
			return Response.json({ ok: false, error: "Failed to cancel subscription." }, { status: 500 });
		}
	}

	// ── CREATE ──────────────────────────────────────────────────────────────────
	if (actionType === "create") {
		const plan = formData.get("plan") || "pro-plan";

		// ✅ Get host from formData (passed from frontend)
		const host = formData.get("host") || url.searchParams.get("host") || "";
		const shop = session.shop;

		const returnUrl = host
			? `${process.env.SHOPIFY_APP_URL}/app?shop=${shop}&host=${host}`
			: `${process.env.SHOPIFY_APP_URL}/app?shop=${shop}`;

		const planConfig = {
			"pro-plan": {
				name: "pro-plan",
				amount: 35,
				currencyCode: "USD",
				interval: "EVERY_30_DAYS",
				trialDays: 15,
			},
			// Add more plans here as needed
		};

		const selectedPlan = planConfig[plan];

		if (!selectedPlan) {
			return Response.json({ ok: false, error: `Unknown plan: ${plan}` }, { status: 400 });
		}

		try {
			const res = await admin.graphql(
				`#graphql
					mutation CreateSubscription(
					$name: String!
					$returnUrl: URL!
					$trialDays: Int
					$lineItems: [AppSubscriptionLineItemInput!]!
					) {
					appSubscriptionCreate(
						name: $name
						returnUrl: $returnUrl
						test: true
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
			console.error("CREATE SUBSCRIPTION ERROR:", error);
			return Response.json({ ok: false, error: "Failed to create subscription." }, { status: 500 });
		}
	}

	return Response.json({ ok: false, error: "Unknown actionType." }, { status: 400 });
};