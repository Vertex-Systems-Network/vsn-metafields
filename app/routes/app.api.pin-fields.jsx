import { authenticate } from "../shopify.server";

const NAMESPACE = "vsn_metafields";

async function getVsnMetafieldDefinitions(admin) {
  const definitions = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query GetPinCandidates($after: String) {
        metafieldDefinitions(first: 100, after: $after, ownerType: PRODUCT) {
          nodes {
            id
            key
            namespace
            pinnedPosition
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      { variables: { after } }
    );

    const data = await res.json();

    if (data?.errors?.length) {
      throw new Error(
        data.errors[0]?.message || "Failed to fetch metafield definitions."
      );
    }

    const connection = data?.data?.metafieldDefinitions;
    definitions.push(...(connection?.nodes || []));
    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    after = connection?.pageInfo?.endCursor || null;
  }

  return definitions.filter((field) => field.namespace === NAMESPACE);
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return Response.json(
    {
      ok: false,
      error: "Method not allowed.",
    },
    {
      status: 405,
      headers: { Allow: "POST" },
    }
  );
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  if (request.method.toUpperCase() !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "Method not allowed.",
      },
      {
        status: 405,
        headers: { Allow: "POST" },
      }
    );
  }

  try {
    const vsnFields = await getVsnMetafieldDefinitions(admin);
    const results = [];

    for (const field of vsnFields) {
      if (field.pinnedPosition !== null) {
        results.push({ key: field.key, status: "already pinned" });
        continue;
      }

      const pinRes = await admin.graphql(
        `#graphql
        mutation UpdateField($id: ID!) {
          metafieldDefinitionUpdate(definition: {
            id: $id
            pin: true
            access: {
              storefront: PUBLIC_READ
            }
          }) {
            updatedDefinition {
              id
              key
              pinnedPosition
            }
            userErrors {
              message
            }
          }
        }`,
        { variables: { id: field.id } }
      );

      const pinData = await pinRes.json();

      if (pinData?.errors?.length) {
        results.push({
          key: field.key,
          status: `error: ${pinData.errors[0]?.message || "GraphQL error"}`,
        });
        continue;
      }

      const errors =
        pinData?.data?.metafieldDefinitionUpdate?.userErrors ?? [];

      results.push({
        key: field.key,
        status: errors.length > 0 ? `error: ${errors[0].message}` : "pinned",
      });
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error?.message || "Failed to pin metafield definitions.",
      },
      { status: 500 }
    );
  }
};
