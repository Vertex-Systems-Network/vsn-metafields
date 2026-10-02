import { useFetcher, useLocation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { submitBilling } from "../billing-client";
import { PRO_PLAN } from "../billing-config";

export default function PackagesPage() {
  const statusFetcher = useFetcher();
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const location = useLocation();

  useEffect(() => {
    if (statusFetcher.state === "idle" && !statusFetcher.data) {
      statusFetcher.load(`/app/api/status${location.search}`);
    }
  }, [location.search, statusFetcher]);

  const subscriptions = statusFetcher.data?.subscriptions ?? [];
  const subscription =
    subscriptions.find((sub) => sub.status === "ACTIVE") || null;

  const isProActive = subscription?.status === "ACTIVE";
  const isLoading =
    statusFetcher.state !== "idle" ||
    submitting;

  const runBilling = async (formData) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await submitBilling(formData, {
        shopify: window.shopify, fetch: window.fetch.bind(window), search: location.search,
      });
      setResult(response);
      if (response.confirmationUrl) {
        // App Bridge supports window.open; direct window.top.location is blocked in embedded apps.
        try { window.open(response.confirmationUrl, "_top"); }
        catch { /* Keep the confirmation link available for a fresh user click. */ }
      }
      if (response.cancelled) statusFetcher.load(`/app/api/status${location.search}`);
    } catch (error) {
      setResult({ error: error.message || "Billing could not complete. Try again." });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleStartPro = () => {
    const formData = new FormData();
    formData.set("actionType", "create");
    formData.set("plan", "pro-plan");

    void runBilling(formData);
  };

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    const formData = new FormData();
    formData.set("actionType", "cancel");
    formData.set("id", subscription?.id);
    void runBilling(formData);
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

      {result?.confirmationUrl && (
        <s-banner tone="info">
          {result.test ? "Test billing: no real charge. " : ""}
          <a href={result.confirmationUrl} target="_top" rel="noreferrer">Continue to Shopify plan approval</a>
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
                    <s-badge tone="success">
                      {subscription?.test ? "Active Test Plan" : "Active Plan"}
                    </s-badge>
                    <s-button
                      tone="critical"
                      type="button"
                      disabled={isLoading || Boolean(result?.confirmationUrl)}
                      loading={isLoading}
                      onClick={handleCancel}
                    >
                      Cancel Subscription
                    </s-button>
                  </s-stack>
                ) : (
                  <s-button
                    variant="primary"
                    type="button"
                    disabled={isLoading || Boolean(result?.confirmationUrl)}
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