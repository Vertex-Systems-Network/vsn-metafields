import { useState } from "react";
import { Link, useFetcher, useLoaderData, useLocation } from "react-router";
import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { listDataRequests, completeDataRequest } from "../privacy-requests.server";
import { PageIntro } from "../components/Workspace";
import ActionButton from "../components/ActionButton";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const db = createPrismaClient();
  try {
    return { requests: await listDataRequests(db, session.shop) };
  } finally {
    await db.$disconnect();
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const db = createPrismaClient();
  try {
    await completeDataRequest(db, session.shop, String(form.get("id") || ""), String(form.get("confirm") || ""));
    return { ok: true };
  } finally {
    await db.$disconnect();
  }
};

export const headers = () => ({ "Cache-Control": "no-store" });

export default function PrivacyRequests() {
  const { requests } = useLoaderData();
  const fetcher = useFetcher();
  const { search } = useLocation();
  const [confirmed, setConfirmed] = useState("");
  const pending = requests.filter((r) => r.status === "pending");
  return (
    <s-page inline-size="large" heading="Customer data requests">
      <PageIntro eyebrow="Privacy" title="Review customer data requests"
        description="Shopify sends requests here. Review saved import snapshots, provide any personal data directly to the store owner, then record fulfillment." />
      <s-banner tone="warning">
        A receipt is not fulfillment. Check all saved imports for personal information in merchant text, including unmatched jobs. Import snapshots expire after seven days; check Shopify&apos;s own records separately. Respond to the store owner within 30 days.
      </s-banner>
      <s-section heading={`Pending requests (${pending.length})`}>
        {!pending.length && <s-text>No pending requests.</s-text>}
        {pending.map((item) => {
          const requestId = item.id.slice(item.id.lastIndexOf(":") + 1);
          const overdue = Date.now() - new Date(item.createdAt).getTime() > 30 * 86400000;
          return (
            <div key={item.id} className="vsn-notice warning">
              <h3>Request {requestId}{overdue ? " · OVERDUE" : ""}</h3>
              <p>Received {new Date(item.createdAt).toLocaleString()} · Customer ID: {item.customerId || "not provided"} · Email: {item.customerEmail || "not provided"} · Phone: {item.customerPhone || "not provided"} · Order IDs: {item.orders.join(", ") || "none"}</p>
              <p>Likely matches: {item.candidateJobIds.length}. Review every saved job because free text can contain personal information without an identifier match.</p>
              <ul>{item.allJobIds.map((id) =>
                <li key={id}><Link to={{pathname:"/app/import",search:`?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(search)), id})}`}}>
                  Import {id}{item.candidateJobIds.includes(id) ? " (identifier match)" : " (manual review)"}
                </Link></li>)}</ul>
              <s-switch label={`I provided the relevant retained app data for request ${requestId} to the store owner`}
                checked={confirmed === item.id}
                onChange={(event) => setConfirmed(event.currentTarget.checked ? item.id : "")} />
              <ActionButton disabled={confirmed !== item.id || fetcher.state !== "idle"}
                loading={fetcher.state !== "idle"}
                onClick={() => {
                  fetcher.submit({id:item.id, confirm:`FULFILLED:${item.id}`}, {method:"post"});
                  setConfirmed("");
                }}>Record fulfilled</ActionButton>
            </div>
          );
        })}
      </s-section>
      {fetcher.data?.ok && <s-banner tone="success">Fulfillment recorded. Refresh to see the updated queue.</s-banner>}
      <s-section heading="Completed requests">
        <s-text>{requests.filter((r) => r.status === "fulfilled").length} completed records. Identifying contact details are cleared on completion; records are purged after 30 days.</s-text>
      </s-section>
    </s-page>
  );
}
