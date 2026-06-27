import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	try {
		const { admin, session } = await authenticate.admin(request);

		console.log("STATUS API SHOP:", session.shop);
		console.log("STATUS API SCOPE:", session.scope);

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

		const rawText = await subscriptionRes.text();

		console.log("SUBSCRIPTION HTTP STATUS:", subscriptionRes.status);
		console.log("SUBSCRIPTION RAW RESPONSE:", rawText);

		let subscriptionData;

		try {
			subscriptionData = JSON.parse(rawText);
		} catch {
			return Response.json(
				{
					ok: false,
					hasActivePlan: false,
					error: "Subscription response is not valid JSON.",
					raw: rawText,
				},
				{ status: 500 }
			);
		}

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
		console.error("STATUS API FAILED:", error);

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