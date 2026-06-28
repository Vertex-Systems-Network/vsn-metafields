import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	// Do NOT wrap this in try/catch
	// authenticate.admin may throw Response/redirect/403 internally
	const { admin, session } = await authenticate.admin(request);

	console.log("STATUS API AUTH OK");
	console.log("STATUS API SHOP:", session.shop);
	console.log("STATUS API SCOPE:", session.scope);

	try {
		const subscriptionRes = await admin.graphql(`
      query {
        appInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }
    `);

		const subscriptionData = await subscriptionRes.json();

		console.log(
			"SUBSCRIPTION DATA:",
			JSON.stringify(subscriptionData, null, 2)
		);

		if (subscriptionData?.errors?.length) {
			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error:
						subscriptionData.errors[0]?.message ||
						"Subscription GraphQL error.",
					details: subscriptionData.errors,
				},
				{ status: 500 }
			);
		}

		const subscriptions =
			subscriptionData?.data?.appInstallation?.activeSubscriptions || [];

		const hasActivePlan = subscriptions.some(
			(subscription) => subscription.status === "ACTIVE"
		);

		return Response.json({
			ok: true,
			shop: session.shop,
			hasActivePlan,
			subscriptions,
		});
	} catch (error) {
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