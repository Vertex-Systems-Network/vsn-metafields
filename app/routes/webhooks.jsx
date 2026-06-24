import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
	const { topic, shop } = await authenticate.webhook(request);
	console.log(`Received ${topic} webhook for ${shop}`);

	switch (topic) {
		case "CUSTOMERS_DATA_REQUEST":
		case "CUSTOMERS_REDACT":
		case "SHOP_REDACT":
			return new Response();
		default:
			return new Response("Unhandled topic", { status: 404 });
	}
};