import ActionButton from "../components/ActionButton";
import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { exportValueCsv } from "../bulk-csv";
import { PageIntro, HelpLink } from "../components/Workspace";
import { LoadingState } from "../components/LoadingState";
function download(name, source) {
  const url = URL.createObjectURL(
    new Blob([source], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function Import() {
  const list = useFetcher(),
    detail = useFetcher(),
    mutation = useFetcher(),
    location = useLocation();
  const [csv, setCsv] = useState(""),
    [selected, setSelected] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const url = useCallback(
    (params = {}) => {
      const s = new URLSearchParams(location.search);
      for (const [k, v] of Object.entries(params)) s.set(k, v);
      return `/app/api/bulk?${s}`;
    },
    [location.search],
  );
  const load = list.load,
    loadDetail = detail.load;
  useEffect(() => {
    load(url());
  }, [load, url]);
  useEffect(() => {
    if (selected) loadDetail(url({ id: selected }));
    setConfirmed(false);
  }, [selected, loadDetail, url]);
  useEffect(() => {
    if (mutation.data?.ok) {
      load(url());
      if (mutation.data.job) {
        setSelected(mutation.data.job.id);
        loadDetail(url({ id: mutation.data.job.id }));
      }
      setConfirmed(false);
    }
  }, [mutation.data, load, url, loadDetail]);
  const job = detail.data?.job?.id === selected ? detail.data.job : null,
    busy = mutation.state !== "idle";
  const submit = (input) =>
    mutation.submit(input, {
      method: "post",
      encType: "application/json",
      action: url(),
    });
  return (
    <s-page inline-size="large" heading="Previewed metafield imports">
      <PageIntro
        eyebrow="Bulk updates"
        title="See every change before you apply it."
        description="Import structured values, review before-and-after snapshots and resume saved jobs without losing your place."
      >
        <HelpLink topic="imports">CSV guide & recovery</HelpLink>
      </PageIntro>
      {!list.data && (
        <LoadingState label="Loading saved import jobs…" skeleton />
      )}
      <s-text>
        Your plan allows {list.data?.plan?.limits?.importRows || "up to 100"}{" "}
        rows per import job.{" "}
        <HelpLink topic="plans">Compare plan limits</HelpLink>
      </s-text>
      <s-section heading="CSV input">
        <s-text>
          Import product, variant or collection values, under 256 KB. This
          workflow writes selected custom fields after preview and leaves
          definition metadata unchanged. Each value is a JSON-encoded string in
          value_json.
        </s-text>
        <ActionButton
          onClick={() =>
            download(
              "metafields-template.csv",
              exportValueCsv([
                {
                  ownerType: "PRODUCT",
                  ownerId: "gid://shopify/Product/REPLACE",
                  namespace: "vsn_metafields",
                  key: "care",
                  type: "single_line_text_field",
                  value: "Example text",
                },
              ]),
            )
          }
        >
          Download CSV template
        </ActionButton>
        <label>
          CSV file{" "}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 256000) {
                window.alert("Use a CSV under 256 KB.");
                return;
              }
              setCsv(await file.text());
            }}
          />
        </label>
        <s-text-area
          label="CSV content"
          value={csv}
          onInput={(e) => setCsv(e.target.value)}
        />
        <ActionButton
          variant="primary"
          loading={busy}
          disabled={!csv || busy}
          onClick={() => submit({ action: "preview", csv })}
        >
          Validate and preview
        </ActionButton>
      </s-section>
      <s-section heading="Saved jobs">
        {list.state === "idle" && list.data?.ok && !list.data.jobs?.length && (
          <div className="vsn-empty">
            <h3>No saved imports yet</h3>
            <p>
              Download the CSV template, add your values and preview the changes
              above.
            </p>
          </div>
        )}
        <s-select
          label="Import job"
          value={selected}
          onInput={(e) => setSelected(e.target.value)}
        >
          <s-option value="">Choose a job</s-option>
          {(list.data?.jobs || []).map((j) => (
            <s-option key={j.id} value={j.id}>
              {j.createdAt} · {j.status} · {j.cursor} processed
            </s-option>
          ))}
        </s-select>
        <ActionButton
          loading={detail.state !== "idle"}
          disabled={!selected || busy || detail.state !== "idle"}
          onClick={() => loadDetail(url({ id: selected }))}
        >
          Refresh selected job
        </ActionButton>
        {job && (
          <>
            <s-text>
              Status: {job.status} · Processed: {job.cursor}/{job.rows.length} ·
              Revision: {job.revision}
            </s-text>
            <s-table>
              <s-table-header-row>
                <s-table-header>Row / resource</s-table-header>
                <s-table-header>Field</s-table-header>
                <s-table-header>Before → proposed</s-table-header>
                <s-table-header>Result</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {job.rows.map((row, i) => (
                  <s-table-row key={row.row}>
                    <s-table-cell>
                      {row.row} / {row.ownerId}
                    </s-table-cell>
                    <s-table-cell>
                      {row.namespace}.{row.key} ({row.type})
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>
                        {row.before === null ? "[absent]" : row.before} →{" "}
                        {row.value}
                      </s-text>
                    </s-table-cell>
                    <s-table-cell>
                      {job.results[i]?.status ||
                        (row.valid ? "valid" : "invalid")}{" "}
                      {job.results[i]?.error || row.error}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            <s-text>
              Invalid rows are skipped. Changed values are conflicts and need a
              new preview. Before export includes previously existing values; it
              omits new values that must be removed individually if you need to
              undo them.
            </s-text>
            <ActionButton
              onClick={() =>
                download(
                  `metafields-before-${job.id}.csv`,
                  exportValueCsv(
                    job.rows
                      .filter((r) => r.valid && r.before !== null)
                      .map((r) => ({ ...r, value: r.before })),
                  ),
                )
              }
            >
              Export before snapshot
            </ActionButton>
            <ActionButton
              onClick={() =>
                download(
                  `metafields-proposed-${job.id}.csv`,
                  exportValueCsv(job.rows.filter((r) => r.valid)),
                )
              }
            >
              Export proposed values
            </ActionButton>
            {["preview", "paused", "running"].includes(job.status) && (
              <>
                <s-checkbox
                  label={`Apply only valid rows from preview ${job.inputHash.slice(0, 12)}`}
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <ActionButton
                  variant="primary"
                  loading={busy}
                  disabled={
                    busy || !confirmed || !job.rows.some((r) => r.valid)
                  }
                  onClick={() =>
                    submit({
                      action: "apply",
                      id: job.id,
                      revision: job.revision,
                      confirm: `APPLY:${job.id}:${job.inputHash}`,
                    })
                  }
                >
                  Apply / resume next chunk
                </ActionButton>
              </>
            )}
            {job.status === "complete" &&
              job.results.some((r) => r.status === "failed") && (
                <ActionButton
                  loading={busy}
                  disabled={busy || !list.data?.plan?.features?.retryImports}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Retry failed rows against the original snapshot? Changed values stay conflicts.",
                      )
                    )
                      submit({
                        action: "retry",
                        id: job.id,
                        revision: job.revision,
                        confirm: `RETRY:${job.id}:${job.inputHash}`,
                      });
                  }}
                >
                  Prepare failed rows for retry
                </ActionButton>
              )}
            {job.status === "complete" &&
              job.results.some((r) => r.status === "failed") &&
              !list.data?.plan?.features?.retryImports && (
                <div className="vsn-notice warning">
                  Failed-row retry is included in Pro. Your snapshots remain
                  available; you can also prepare a fresh CSV preview.{" "}
                  <HelpLink topic="plans">Compare Pro</HelpLink>
                </div>
              )}
            <ActionButton
              tone="critical"
              disabled={busy || job.status === "running"}
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this saved job and snapshots? Shopify values stay unchanged.",
                  )
                ) {
                  submit({
                    action: "remove",
                    id: job.id,
                    confirm: `REMOVE_JOB:${job.id}`,
                  });
                  setSelected("");
                }
              }}
            >
              Remove saved job
            </ActionButton>
          </>
        )}
      </s-section>
      {selected && detail.state !== "idle" && (
        <LoadingState label="Loading your saved preview…" skeleton={!job} />
      )}
      {busy && <LoadingState label="Processing the confirmed import action…" />}
      {[list, detail, mutation].map((f, i) =>
        f.data?.error ? (
          <s-banner tone="critical" key={i}>
            {f.data.error}
          </s-banner>
        ) : null,
      )}
      <Link to={{ pathname: "/app/guide", search: location.search }}>
        Recovery guidance and diagnostics
      </Link>
    </s-page>
  );
}
