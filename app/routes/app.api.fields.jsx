import { authenticate } from "../shopify.server";

const NAMESPACE = "vsn_metafields";

async function getVsnMetafieldDefinitions(admin) {
	const res = await admin.graphql(`
    query {
      metafieldDefinitions(first: 100, ownerType: PRODUCT) {
        nodes {
          id
          name
          key
          namespace
          type {
            name
          }
        }
      }
    }
  `);

	const data = await res.json();

	if (data?.errors) {
		throw new Error(
			data.errors[0]?.message || "Failed to fetch metafield definitions."
		);
	}

	const definitions = data?.data?.metafieldDefinitions?.nodes || [];

	return definitions
		.filter((field) => field.namespace === NAMESPACE)
		.map((field) => ({
			id: field.id,
			name: field.name,
			key: field.key,
			namespace: field.namespace,
			type: field.type?.name,
		}));
}

export const loader = async ({ request }) => {
	const { admin, session } = await authenticate.admin(request);

	console.log("Fields API shop:", session.shop);
	console.log("Fields API scope:", session.scope);

	try {
		const fields = await getVsnMetafieldDefinitions(admin);

		return Response.json({
			ok: true,
			fields,
		});
	} catch (error) {
		console.error("Fields list API failed:", error);

		return Response.json(
			{
				ok: false,
				fields: [],
				error: error?.message || "Failed to load fields.",
			},
			{ status: 500 }
		);
	}
};

export const action = async ({ request }) => {
	const { admin, session } = await authenticate.admin(request);

	console.log("Fields action shop:", session.shop);
	console.log("Fields action scope:", session.scope);

	try {
		const method = request.method.toUpperCase();

		if (method === "DELETE") {
			const fields = await getVsnMetafieldDefinitions(admin);

			let deletedCount = 0;
			const deleteErrors = [];

			for (const field of fields) {
				const deleteRes = await admin.graphql(
					`#graphql
						mutation DeleteMetafieldDefinition($id: ID!) {
							metafieldDefinitionDelete(
							id: $id,
							deleteAllAssociatedMetafields: false
							) {
							deletedDefinitionId
							userErrors {
								field
								message
							}
							}
						}`,
					{
						variables: {
							id: field.id,
						},
					}
				);

				const deleteData = await deleteRes.json();

				if (deleteData?.errors?.length) {
					deleteErrors.push(
						deleteData.errors[0]?.message || "Delete GraphQL error."
					);
					continue;
				}

				const userErrors =
					deleteData?.data?.metafieldDefinitionDelete?.userErrors || [];

				if (userErrors.length > 0) {
					deleteErrors.push(userErrors[0]?.message || "Delete user error.");
					continue;
				}

				deletedCount++;
			}

			if (deleteErrors.length > 0) {
				return Response.json(
					{
						ok: false,
						success: false,
						error: deleteErrors[0],
					},
					{ status: 400 }
				);
			}

			return Response.json({
				ok: true,
				success: true,
				message: `${deletedCount} metafield definition(s) deleted.`,
			});
		}

		if (method !== "POST") {
			return Response.json(
				{
					ok: false,
					success: false,
					error: "Method not allowed.",
				},
				{ status: 405 }
			);
		}

		const formData = await request.formData();

		const name = formData.get("name");
		const key = formData.get("key");
		const type = formData.get("type");

		if (!name || !key || !type) {
			return Response.json(
				{
					ok: false,
					success: false,
					error: "Missing fields.",
				},
				{ status: 400 }
			);
		}

		const cleanName = String(name).trim();

		const cleanKey = String(key)
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_")
			.replace(/[^a-z0-9_]/g, "");

		if (!cleanName || !cleanKey) {
			return Response.json(
				{
					ok: false,
					success: false,
					error: "Invalid field name or key.",
				},
				{ status: 400 }
			);
		}

		const mutation = await admin.graphql(
			`#graphql
			mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
				metafieldDefinitionCreate(definition: $definition) {
				createdDefinition {
					id
					name
					namespace
					key
					type {
					name
					}
				}
				userErrors {
					field
					message
				}
				}
			}`,
			{
				variables: {
					definition: {
						name: cleanName,  // ✅
						key: cleanKey,    // ✅
						namespace: NAMESPACE,
						type,
						ownerType: "PRODUCT",
						pin: true,
						visibleToStorefrontApi: true,
					},
				},
			}
		);

		const result = await mutation.json();

		if (result?.errors?.length) {
			return Response.json(
				{
					ok: false,
					success: false,
					error: result.errors[0]?.message || "Create GraphQL error.",
				},
				{ status: 400 }
			);
		}

		const userErrors =
			result?.data?.metafieldDefinitionCreate?.userErrors || [];

		if (userErrors.length > 0) {
			return Response.json(
				{
					ok: false,
					success: false,
					error: userErrors[0]?.message || "Failed to create metafield.",
				},
				{ status: 400 }
			);
		}

		return Response.json({
			ok: true,
			success: true,
			message: "Metafield created successfully.",
			metafield:
				result?.data?.metafieldDefinitionCreate?.createdDefinition,
		});
	} catch (error) {
		console.error("Fields action API failed:", error);

		return Response.json(
			{
				ok: false,
				success: false,
				error: error?.message || "Fields action failed.",
			},
			{ status: 500 }
		);
	}
};