import { ActionFunctionArgs, ActionFunction } from "react-router";
import db from "../db.server";
import { authenticate } from "~/shopify.server";

export const action: ActionFunction = async ({ request }: ActionFunctionArgs) => {
	const { topic, shop, session } = await authenticate.webhook(request);

	switch (topic) {
		case "APP_UNINSTALLED":
			if (session) {
				await db.session.deleteMany({
					where: { shop },
				});
			}
			break;

		case "CUSTOMERS_DATA_REQUEST":
			// TODO: Handle GDPR request
			break;

		case "CUSTOMERS_REDACT":
			// TODO: Handle GDPR redaction
			break;

		case "SHOP_REDACT":
			// TODO: Handle shop redaction
			break;

		default:
			return new Response("Unhandled webhook topic", { status: 404 });
	}

	return new Response(null, { status: 200 });
};