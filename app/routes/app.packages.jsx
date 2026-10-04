import { useFetcher, useLocation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { openBillingApproval, submitBilling } from "../billing-client";
import { PLAN_BY_ID, PLANS, planFromSubscriptions } from "../billing-config";
import { PageIntro, HelpLink } from "../components/Workspace";
import { LoadingState } from "../components/LoadingState";

export default function PackagesPage() {
  const statusFetcher = useFetcher();
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const inFlight = useRef(false);
  const location = useLocation();
  const load = statusFetcher.load;
  useEffect(() => {
    load(`/app/api/status${location.search}`);
  }, [load, location.search]);
  const subscriptions = Array.isArray(statusFetcher.data?.subscriptions)
    ? statusFetcher.data.subscriptions
    : [];
  const currentPlan = planFromSubscriptions(subscriptions);
  const subscription =
    subscriptions.find(
      (s) => s.status === "ACTIVE" && s.name === currentPlan?.name,
    ) || subscriptions.find((s) => s.status === "ACTIVE");
  const verified = statusFetcher.data?.ok === true;
  const params = new URLSearchParams(location.search);
  const returnedPlan = params.get("billing_return") === "1"
    ? PLAN_BY_ID[params.get("requested_plan")]
    : null;
  const latestRequest = Array.isArray(statusFetcher.data?.recentSubscriptions)
    ? statusFetcher.data.recentSubscriptions.find((item) => PLAN_BY_ID[item.name])
    : null;
  const requestAge = Date.now() - Date.parse(latestRequest?.createdAt);
  const recentRequest = latestRequest &&
    ["PENDING", "DECLINED", "EXPIRED"].includes(latestRequest.status) &&
    Number.isFinite(requestAge) && requestAge >= 0 &&
    requestAge < 48 * 60 * 60 * 1000
      ? latestRequest
      : null;
  const isLoading = statusFetcher.state !== "idle" || submitting;
  useEffect(() => {
    if (verified && currentPlan?.id === result?.requestedPlan) setResult(null);
  }, [verified, currentPlan?.id, result?.requestedPlan]);
  const runBilling = async (formData) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setPendingAction(
      formData.get("actionType") === "cancel"
        ? "cancel"
        : String(formData.get("plan")),
    );
    setResult(null);
    try {
      const response = await submitBilling(formData, {
        shopify: window.shopify,
        fetch: window.fetch.bind(window),
        search: location.search,
      });
      if (response.confirmationUrl) {
        const requestedPlan = String(formData.get("plan"));
        setResult({ ...response, requestedPlan });
        // App Bridge handles top-level navigation from an embedded app. The
        // explicit link below remains available if the browser blocks it.
        try {
          openBillingApproval(response.confirmationUrl, window.open.bind(window));
        } catch {
          // A blocked top-level navigation still leaves the Shopify link below.
        }
      } else {
        setResult(response);
      }
      if (response.cancelled) load(`/app/api/status${location.search}`);
    } catch (error) {
      setResult({
        error: error.message || "Billing could not complete. Try again.",
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      setPendingAction("");
    }
  };
  const choosePlan = (plan) => {
    if (
      currentPlan &&
      !window.confirm(
        `Change from ${currentPlan.label} to ${plan.label} at $${plan.amount} USD every 30 days? Shopify will show the billing details before approval. Existing content stays in your store; new writes must fit the selected plan.`,
      )
    )
      return;
    const form = new FormData();
    form.set("actionType", "create");
    form.set("plan", plan.id);
    void runBilling(form);
  };
  const cancel = () => {
    if (
      !window.confirm(
        "Cancel this subscription? Paid editing will stop when Shopify confirms cancellation. Your Shopify content will remain.",
      )
    )
      return;
    const form = new FormData();
    form.set("actionType", "cancel");
    form.set("id", subscription.id);
    void runBilling(form);
  };
  return (
    <s-page inline-size="large" heading="Plans">
      <PageIntro
        eyebrow="Room to grow"
        title="Choose the right fit for your store."
        description="Start with essential editing, then unlock larger imports, public metaobjects and recovery tools in Pro. Unlimited products and all five theme blocks are included in every plan."
      >
        <HelpLink topic="plans">Billing & plan help</HelpLink>
      </PageIntro>
      {!statusFetcher.data && (
        <LoadingState label="Checking your Shopify subscription…" skeleton />
      )}
      {statusFetcher.data && !statusFetcher.data.ok && (
        <div className="vsn-notice error" role="alert">
          {statusFetcher.data.error ||
            "Could not check your subscription. Refresh to try again."}
        </div>
      )}
      {currentPlan && (
        <div className="vsn-notice success">
          <strong>
            {currentPlan.label} is active
            {subscription?.test ? " · Test subscription" : ""}.
          </strong>{" "}
          {subscription?.currentPeriodEnd
            ? `Current period ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}.`
            : "Your editing tools are ready."}
        </div>
      )}
      {returnedPlan && verified && (
        <div
          className={`vsn-notice ${currentPlan?.id === returnedPlan.id ? "success" : ""}`}
          role="status"
        >
          {currentPlan?.id === returnedPlan.id
            ? `Shopify confirms ${returnedPlan.label} is active.`
            : `Returned from Shopify, but ${returnedPlan.label} is not active yet. Check the latest request status below or refresh subscription status.`}
        </div>
      )}
      {recentRequest && (
        <div
          className={`vsn-notice ${recentRequest.status === "PENDING" ? "" : "error"}`}
          role="status"
        >
          <strong>
            Latest {PLAN_BY_ID[recentRequest.name].label} request: {recentRequest.status.toLowerCase()}.
          </strong>{" "}
          {recentRequest.status === "PENDING"
            ? "Shopify has not activated this plan. Open its approval link if available, then refresh subscription status."
            : "Shopify did not activate this request. Select a plan again to get a new approval link."}
        </div>
      )}
      {result?.confirmationUrl && currentPlan?.id !== result.requestedPlan && (
        <div className="vsn-notice" role="status">
          <strong>Shopify approval is required to switch plans.</strong>{" "}
          {result.test && "This is test billing with no real charge. "}
          <p>
            Opening Shopify approval. If it does not open, use the button below.
            Your current plan remains active until Shopify confirms the change.
          </p>
          <a
            className="vsn-button primary"
            href={result.confirmationUrl}
            target="_top"
            rel="noreferrer"
          >
            Review and approve in Shopify
          </a>
        </div>
      )}
      {result?.error && (
        <div className="vsn-notice error" role="alert">
          {result.error}
        </div>
      )}
      {result?.cancelled && (
        <div className="vsn-notice success" role="status">
          Shopify confirmed cancellation. Your content has been retained.
        </div>
      )}
      <div className="vsn-plan-grid">
        {PLANS.map((plan) => {
          const current = currentPlan?.id === plan.id;
          return (
            <article
              className={`vsn-plan ${current ? "current" : plan.id === "pro-plan" ? "featured" : ""}`}
              key={plan.id}
              aria-label={`${plan.label} plan`}
            >
              <div className="vsn-plan-label">
                {current
                  ? "Your current plan"
                  : plan.id === "pro-plan"
                    ? "Recommended · Full content workflow"
                    : plan.id === "growth-plan"
                      ? "More room for private content"
                      : "Start with the essentials"}
              </div>
              <h2 className="vsn-plan-heading">
                {plan.label}
                {current && <span className="vsn-active-badge">Active</span>}
              </h2>
              <p>{plan.description}</p>
              <div className="vsn-price">
                ${plan.amount}
                <span> USD / 30 days</span>
              </div>
              <div className="vsn-trial">
                {currentPlan
                  ? "Plan changes require Shopify approval"
                  : `${plan.trialDays}-day trial, then $${plan.amount} every 30 days`}
              </div>
              <ul>
                <li>
                  <strong>{plan.limits.importRows}</strong> rows per CSV import
                </li>
                <li>
                  <strong>{plan.limits.listItems}</strong> items per list value
                </li>
                <li>
                  <strong>{plan.limits.metaobjectFields}</strong> fields per new
                  metaobject definition
                </li>
                <li>Standard & custom definitions</li>
                <li>Typed values & private draft metaobjects</li>
                <li>All 5 customizable theme blocks</li>
                <li>Import preview, conflict checks & exports</li>
                <li>Unlimited products</li>
                <li
                  className={
                    plan.features.publicMetaobjects
                      ? "vsn-included"
                      : "vsn-pro-feature"
                  }
                >
                  {plan.features.publicMetaobjects
                    ? "Public metaobject publishing"
                    : "Public metaobject publishing · Pro only"}
                </li>
                <li
                  className={
                    plan.features.retryImports
                      ? "vsn-included"
                      : "vsn-pro-feature"
                  }
                >
                  {plan.features.retryImports
                    ? "Failed-import retry preparation"
                    : "Failed-import retry preparation · Pro only"}
                </li>
              </ul>
              <button
                className={`vsn-button ${!current && plan.id === "pro-plan" ? "primary" : "secondary"}`}
                disabled={
                  !verified ||
                  isLoading ||
                  current ||
                  Boolean(result?.confirmationUrl)
                }
                onClick={() => choosePlan(plan)}
              >
                {submitting && pendingAction === plan.id
                  ? "Opening Shopify…"
                  : current
                    ? "Current plan"
                    : currentPlan
                      ? `Switch to ${plan.label}`
                      : `Start ${plan.label} trial`}
              </button>
              {current && subscription && (
                <button
                  className="vsn-button danger vsn-plan-cancel"
                  disabled={isLoading}
                  onClick={cancel}
                >
                  {pendingAction === "cancel"
                    ? "Cancelling subscription…"
                    : "Cancel this plan"}
                </button>
              )}
              <div className="vsn-plan-status">
                {plan.id === "pro-plan"
                  ? "Existing Pro price and 5-day trial preserved."
                  : plan.id === "growth-plan"
                    ? "4× Starter import and list capacity."
                    : "All the core tools in one workspace."}
              </div>
            </article>
          );
        })}
      </div>
      <div className="vsn-table-wrap">
        <table className="vsn-comparison">
          <caption>Compare your capacity</caption>
          <thead>
            <tr>
              <th scope="col">Limit</th>
              {PLANS.map((p) => (
                <th scope="col" key={p.id}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Rows per CSV import", "importRows"],
              ["Items per list value", "listItems"],
              ["Fields per new metaobject definition", "metaobjectFields"],
            ].map(([label, key]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits[key]}</td>
                ))}
              </tr>
            ))}
            {[
              [
                "Public metaobject access & Active entry saves",
                "publicMetaobjects",
              ],
              ["Prepare failed import rows for retry", "retryImports"],
            ].map(([label, key]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {PLANS.map((p) => (
                  <td key={p.id}>
                    {p.features[key] ? "Included" : "Pro only"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vsn-notice">
        Limits apply to each import, list value or new definition, rather than
        your total number of products or monthly usage. A smaller plan keeps
        existing content, public entries, logs and exports. New writes must fit
        its limits; saving Active public metaobject entries and preparing
        failed-row retries require Pro. Metadata edits and selected removals
        remain available. Shopify shows the billing and replacement terms before
        you approve; switching an active plan does not start another trial.
      </div>
      <div className="vsn-hero-actions">
        <button
          className="vsn-button"
          disabled={isLoading}
          onClick={() => {
            setResult(null);
            load(`/app/api/status${location.search}`);
          }}
        >
          Refresh subscription status
        </button>
      </div>
      {submitting && (
        <LoadingState
          label={
            pendingAction === "cancel"
              ? "Waiting for Shopify cancellation confirmation…"
              : "Opening Shopify plan approval…"
          }
        />
      )}
    </s-page>
  );
}
