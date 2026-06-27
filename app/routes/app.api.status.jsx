import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	const { admin, session } = await authenticate.admin(request);

	console.log("API status shop:", session.shop);
	console.log("API status scope:", session.scope);

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

		if (subscriptionData?.errors?.length) {
			console.error("Subscription GraphQL errors:", subscriptionData.errors);

			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error:
						subscriptionData.errors[0]?.message ||
						"Subscription query failed.",
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
		console.error("Status API failed:", error);

		return Response.json(
			{
				ok: false,
				hasActivePlan: false,
				error: error?.message || "Status API failed.",
			},
			{ status: 500 }
		);
	}
};