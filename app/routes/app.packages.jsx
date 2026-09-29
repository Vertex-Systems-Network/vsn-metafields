import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { PRO_PLAN } from "../billing-config";

// ─── Loader: reuse status API logic directly ──────────────────────────────────
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");

  // authenticate.admin handles the session exchange automatically
  const { admin } = await authenticate.admin(request);

  //console.log("PACKAGES SHOP:", session?.shop);
  //console.log("CHARGE ID:", chargeId); // confirm it's being received

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

  const isProductionBilling =
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const validSubscriptions = isProductionBilling
    ? activeSubscriptions.filter((sub) => !sub.test)
    : activeSubscriptions;

  const subscription =
    validSubscriptions.find((sub) => sub.status === "ACTIVE") || null;

  //console.log("PACKAGES SUBSCRIPTION:", subscription);

  return { subscription, chargeId };
}

export default function PackagesPage() {
  const statusFetcher = useFetcher();
  const actionFetcher = useFetcher();
  const location = useLocation();

  useEffect(() => {
    statusFetcher.load(`/app/api/status${location.search}`);
  }, [location.search]);

  const subscriptions = statusFetcher.data?.subscriptions ?? [];
  const subscription =
    subscriptions.find((sub) => sub.status === "ACTIVE") || null;

  const isProActive =
    subscription?.name === "pro-plan" &&
    subscription?.status === "ACTIVE";
  const isLoading =
    statusFetcher.state !== "idle" ||
    actionFetcher.state !== "idle";
  const result = actionFetcher.data;

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

    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/status${window.location.search}`,
    });
  };

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    const formData = new FormData();
    formData.set("actionType", "cancel");
    formData.set("id", subscription?.id);
    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/status${window.location.search}`,
    });
  };

  return (
    <s-page heading="Packages">

      {statusFetcher.state === "loading" && !statusFetcher.data && (
        <s-banner tone="info">Checking subscription status...</s-banner>
      )}

      {statusFetcher.data && !statusFetcher.data.ok && (
        <s-banner tone="critical">
          {statusFetcher.data.error || "Failed to load subscription status."}
        </s-banner>
      )}

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
                <s-text>{PRO_PLAN.trialDays}-day free trial</s-text>
                <s-text>${PRO_PLAN.amount} / month after trial</s-text>
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
                    Start {PRO_PLAN.trialDays}-Day Trial
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