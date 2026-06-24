import { authenticate } from "../shopify.server";
import { redirect } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
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

  const data = await res.json();
  const subscription = data?.data?.appInstallation?.activeSubscriptions?.[0] || null;

  return { subscription };
}

async function cancelSubscription(admin, id) {
  const res = await admin.graphql(`
    mutation {
      appSubscriptionCancel(
        id: "${id}"
        prorate: true
      ) {
        userErrors {
          message
        }
        appSubscription {
          id
          status
        }
      }
    }
  `);
  return await res.json();
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // CANCEL
  if (actionType === "cancel") {
    const id = formData.get("id");
    await cancelSubscription(admin, id);
    return redirect("/app/packages");
  }

  // Must return to packages so active badge shows
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app`;

  const mutation = await admin.graphql(`
  mutation {
    appSubscriptionCreate(
      name: "pro-plan"
      returnUrl: "${returnUrl}"
      test: true
      trialDays: 15
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: 35
                currencyCode: USD
              }
              interval: EVERY_30_DAYS
            }
          }
        }
      ]
    ) {
      confirmationUrl
      userErrors {
        message
      }
    }
  }
`);

  const result = await mutation.json();

  const errors = result?.data?.appSubscriptionCreate?.userErrors || [];
  if (errors.length > 0) {
    return { error: errors[0].message };
  }

  const confirmationUrl = result?.data?.appSubscriptionCreate?.confirmationUrl;

  if (!confirmationUrl) {
    return { error: "No confirmation URL returned from Shopify." };
  }

  // Return URL to frontend — fetcher will handle the redirect
  return { confirmationUrl };
}

export default function PackagesPage() {
  const { subscription } = useLoaderData();
  const fetcher = useFetcher();

  const activePlan = subscription?.name;
  const isProActive = activePlan === "pro-plan";
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  // When action returns confirmationUrl, redirect the top frame
  useEffect(() => {
    if (result?.confirmationUrl) {
      // Shopify embedded apps need to redirect the parent frame
      window.top.location.href = result.confirmationUrl;
    }
  }, [result]);

  const handleStartPro = () => {
    const formData = new FormData();
    formData.set("plan", "PRO");
    fetcher.submit(formData, { method: "post" });
  };

  const handleCancel = () => {
    const formData = new FormData();
    formData.set("actionType", "cancel");
    formData.set("id", subscription?.id);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Packages">

      {result?.error && (
        <s-banner tone="critical">{result.error}</s-banner>
      )}

      <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">

        <s-grid-item gridColumn="span 6" gridRow="span 1">
          <s-section>
            <s-box
              padding="base"
              background="base"
              borderRadius="base"
              borderWidth="base"
              borderColor="base"
            >
              <s-stack gap="base">
                <s-text variant="headingMd">Pro Plan</s-text>
                <s-text>15-day free trial</s-text>
                <s-text>$35 / month after trial</s-text>
                <s-text>Unlimited products</s-text>
                <s-text>Priority support</s-text>

                {isProActive ? (
                  <s-stack gap="small">
                    <s-badge tone="success">Active Plan</s-badge>
                    <s-button
                      tone="critical"
                      loading={isLoading}
                      onClick={handleCancel}
                    >
                      Deactivate
                    </s-button>
                  </s-stack>
                ) : (
                  <s-button
                    variant="primary"
                    loading={isLoading}
                    onClick={handleStartPro}
                  >
                    Start 15-Day Trial
                  </s-button>
                )}
              </s-stack>
            </s-box>
          </s-section>
        </s-grid-item>

      </s-grid>
    </s-page>
  );
}