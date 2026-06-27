import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	const { admin, session } = await authenticate.admin(request);

	console.log("Status check shop:", session.shop);
	console.log("Status check scope:", session.scope);

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
			return {
				ok: false,
				error: "Subscription query failed",
				details: subscriptionData.errors,
			};
		}

		const subscriptions =
			subscriptionData?.data?.appInstallation?.activeSubscriptions || [];

		const hasActivePlan = subscriptions.some((s) => s.status === "ACTIVE");

		if (!hasActivePlan) {
			return {
				ok: true,
				hasActivePlan: false,
				fields: [],
			};
		}

		const fieldsRes = await admin.graphql(`
			query {
				metafieldDefinitions(first: 100, ownerType: PRODUCT) {
				nodes {
					id
					name
					key
					type {
					name
					}
					namespace
				}
				}
			}
		`);

		const fieldsData = await fieldsRes.json();

		if (fieldsData?.errors?.length) {
			console.error("Metafield GraphQL errors:", fieldsData.errors);
			return {
				ok: false,
				error: "Metafield definitions query failed",
				details: fieldsData.errors,
			};
		}

		const definitions = fieldsData?.data?.metafieldDefinitions?.nodes || [];

		const fields = definitions
			.filter((f) => f.namespace === "vsn_metafields")
			.map((f) => ({
				id: f.id,
				name: f.name,
				key: f.key,
				type: f.type?.name,
			}));

		return {
			ok: true,
			hasActivePlan: true,
			fields,
		};
	} catch (error) {
		console.error("Status route failed:", error);

		return {
			ok: false,
			error: error?.message || "Unknown server error",
		};
	}
};