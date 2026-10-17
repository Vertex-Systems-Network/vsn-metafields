import { useState } from "react";
import { Link, useFetcher, useLoaderData, useLocation } from "react-router";
import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { listDataRequests, completeDataRequest } from "../privacy-requests.server";
import { PageIntro } from "../components/Workspace";
import ActionButton from "../components/ActionButton";
import { featureError } from "../feature-request.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const db = createPrismaClient();
  try {
    return await listDataRequests(db, session.shop);
  } finally {
    await db.$disconnect();
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const db = createPrismaClient();
  try {
    await completeDataRequest(
      db, session.shop,
      String(form.get("id") || ""),
      String(form.get("confirm") || ""),
      String(form.get("reviewVersion") || ""),
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof RangeError) return featureError(error);
    throw error;
  } finally {
    await db.$disconnect();
  }
};

export const headers = () => ({ "Cache-Control": "no-store" });

export default function PrivacyRequests() {
  const { requests, pendingCount, completedCount } = useLoaderData();
  const fetcher = useFetcher();
  const { search } = useLocation();
  const [confirmed, setConfirmed] = useState("");
  return (
    <s-page inline-size="large" heading="Customer data requests">
      <PageIntro eyebrow="Privacy" title="Review customer data requests"
        description="Shopify sends requests here. Review saved import snapshots, provide any personal data directly to the store owner, then record fulfillment." />
      <s-banner tone="warning">
        A receipt is not fulfillment. Check all saved imports for personal information in merchant text, including unmatched jobs. Import snapshots expire after seven days; check Shopify&apos;s own records separately. Respond to the store owner within 30 days.
      </s-banner>
      <s-section heading={`Pending requests (${pendingCount})`}>
        {!pendingCount && <s-text>No pending requests.</s-text>}
        {pendingCount > requests.length && (
          <s-banner tone="warning">
            Showing the 50 oldest pending requests. Fulfill reviewed requests and refresh to continue through the remaining {pendingCount - requests.length}.
          </s-banner>
        )}
        {requests.map((item) => {
          const requestId = item.id.slice(item.id.lastIndexOf(":") + 1);
          const overdue = Date.now() - new Date(item.createdAt).getTime() > 30 * 86400000;
          return (
            <div key={item.id} className="vsn-notice warning">
              <h3>Request {requestId}{overdue ? " · OVERDUE" : ""}</h3>
              <p>Received {new Date(item.createdAt).toLocaleString()} · Customer ID: {item.customerId || "not provided"} · Email: {item.customerEmail || "not provided"} · Phone: {item.customerPhone || "not provided"} · Order IDs: {item.orders.join(", ") || "none"}</p>
              {item.ordersUnreadable && (
                <s-banner tone="critical">
                  The saved requested order IDs are unreadable. Recover the original order scope and review all relevant records before recording fulfillment.
                </s-banner>
              )}
              <p>Likely matches: {item.candidateJobIds.length}. Review every saved job because free text can contain personal information without an identifier match.</p>
              {!!item.unreadableJobIds?.length && (
                <s-banner tone="critical">
                  {item.unreadableJobIds.length} retained import snapshot(s) are unreadable. Review these jobs and recover relevant personal data before recording fulfillment; an unreadable snapshot is not proof that no personal data exists.
                </s-banner>
              )}
              <ul>{item.allJobIds.map((id) =>
                <li key={id}><Link to={{pathname:"/app/import",search:`?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(search)), id})}`}}>
                  Import {id}{item.unreadableJobIds?.includes(id) ? " (unreadable snapshot — manual recovery required)" : item.candidateJobIds.includes(id) ? " (identifier match)" : " (manual review)"}
                </Link></li>)}</ul>
              <s-switch label={`I provided the relevant retained app data for request ${requestId} to the store owner`}
                checked={confirmed === item.id}
                onChange={(event) => setConfirmed(event.currentTarget.checked ? item.id : "")} />
              <ActionButton disabled={item.ordersUnreadable || !!item.unreadableJobIds?.length || confirmed !== item.id || fetcher.state !== "idle"}
                loading={fetcher.state !== "idle"}
                onClick={() => {
                  fetcher.submit({
                    id: item.id, confirm: `FULFILLED:${item.id}`,
                    reviewVersion: item.reviewVersion,
                  }, {method:"post"});
                  setConfirmed("");
                }}>Record fulfilled</ActionButton>
            </div>
          );
        })}
      </s-section>
      {fetcher.data?.ok && <s-banner tone="success">Fulfillment recorded.</s-banner>}
      {fetcher.data?.error && <s-banner tone="critical">{fetcher.data.error}</s-banner>}
      <s-section heading="Completed requests">
        <s-text>{completedCount} completed records. Identifying contact details are cleared on completion; records are purged after 30 days.</s-text>
      </s-section>
    </s-page>
  );
}
