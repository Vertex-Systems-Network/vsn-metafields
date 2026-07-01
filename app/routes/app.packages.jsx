import { ActionFunctionArgs, LoaderFunction } from 'react-router';
import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";

// ─── Loader: reuse status API logic directly ──────────────────────────────────
export const loader: LoaderFunction = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");

  // authenticate.admin handles the session exchange automatically
  const { admin, session } = await authenticate.admin(request);

  console.log("PACKAGES SHOP:", session?.shop);
  console.log("CHARGE ID:", chargeId); // confirm it's being received

  // Small delay if charge_id present — Shopify needs a moment to activate
  if (chargeId) {
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const res = await admin.graphql(`
    #graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id name status test currentPeriodEnd trialDays
        }
      }
    }
  `);

  const data = await res.json();
  const activeSubscriptions =
    data?.data?.currentAppInstallation?.activeSubscriptions ?? [];

  const validSubscriptions =
    process.env.NODE_ENV === "production"
      ? activeSubscriptions.filter((sub) => !sub.test)
      : activeSubscriptions;

  const subscription =
    validSubscriptions.find((sub) => sub.status === "ACTIVE") || null;

  console.log("PACKAGES SUBSCRIPTION:", subscription);

  return { subscription, chargeId };
}

export default function PackagesPage() {
  const { subscription } = useLoaderData();
  const fetcher = useFetcher();

  const isProActive = subscription?.name === "pro-plan" && subscription?.status === "ACTIVE";
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  // Redirect to Shopify billing confirmation page
  useEffect(() => {
    if (result?.confirmationUrl) {
      window.top.location.href = result.confirmationUrl;
    }
  }, [result]);

  // After cancel, reload the page to refresh subscription status
  useEffect(() => {
    if (result?.cancelled) {
      window.location.reload();
    }
  }, [result]);

  const handleStartPro = () => {
    const formData = new FormData();
    formData.set("actionType", "create");
    formData.set("plan", "pro-plan");

    // ✅ Pass host from current page URL
    const params = new URLSearchParams(window.location.search);
    formData.set("host", params.get("host") ?? "");
    formData.set("shop", params.get("shop") ?? "");

    fetcher.submit(formData, {
      method: "post",
      action: `/app/api/status${window.location.search}`,
    });
  };

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    const formData = new FormData();
    formData.set("actionType", "cancel");
    formData.set("id", subscription?.id);
    fetcher.submit(formData, {
      method: "post",
      action: `/app/api/status${window.location.search}`,
    });
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

                {subscription?.trialDays > 0 && (
                  <s-text tone="success">
                    {subscription.trialDays} trial days remaining
                  </s-text>
                )}

                {subscription?.currentPeriodEnd && (
                  <s-text tone="subdued">
                    Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </s-text>
                )}

                {isProActive ? (
                  <s-stack gap="small">
                    <s-badge tone="success">Active Plan</s-badge>
                    <s-button
                      tone="critical"
                      loading={isLoading}
                      onClick={handleCancel}
                    >
                      Cancel Subscription
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