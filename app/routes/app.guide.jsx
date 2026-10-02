import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
export default function Guide() {
  const diagnostics = useFetcher(),
    location = useLocation(),
    [copied, setCopied] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const load = diagnostics.load;
  useEffect(() => {
    load(`/app/api/diagnostics${location.search}`);
  }, [load, location.search]);
  const info = diagnostics.data?.diagnostics;
  const link = (pathname) => ({ pathname, search: location.search });
  return (
    <s-page heading="Setup and diagnostics">
      <s-section heading="Get started">
        <s-ordered-list>
          <s-list-item>
            <Link to={link("/app/packages")}>Check your plan</Link>. New
            features use the existing active-plan rule.
          </s-list-item>
          <s-list-item>
            <Link to={link("/app")}>
              Choose an owner and enable a standard definition or create a
              custom field
            </Link>
            . Use a merchant namespace; type and key stay fixed.
          </s-list-item>
          <s-list-item>
            Choose product, variant or collection, select the definition, enter
            its typed value and save. For references, choose an existing
            accessible resource.
          </s-list-item>
          <s-list-item>
            <Link to={link("/app/metaobjects")}>
              Build reusable metaobject content
            </Link>
            . New entries start as drafts; public publishing needs confirmation.
          </s-list-item>
          <s-list-item>
            <Link to={link("/app/import")}>Preview an import</Link>, inspect
            invalid rows and before/after values, then apply the exact preview.
            Conflicts require a fresh preview.
          </s-list-item>
          <s-list-item>
            Open Shopify → Online store → Themes → Customize. Add VSN Single
            field, Specifications, Reference cards or FAQ. Match namespace/key
            and preview each resource and variant.
          </s-list-item>
        </s-ordered-list>
        <s-text>
          Theme visibility depends on supported Liquid context, public content
          and publishable status. Customer/order content is excluded. Enabling
          API storefront access alone does not verify theme output.
        </s-text>
      </s-section>
      <s-section heading="Connection and permissions">
        {diagnostics.data?.error && (
          <s-banner tone="critical">{diagnostics.data.error}</s-banner>
        )}
        {info && (
          <>
            <s-text>
              API {info.apiVersion} · Environment {info.environment} · Database{" "}
              {info.database} · Active plan {info.hasActivePlan ? "yes" : "no"}{" "}
              · Saved import jobs {info.importJobCount}
            </s-text>
            {Object.entries(info.features).map(([name, state]) => (
              <s-box key={name} padding="base">
                <s-text>
                  {name}:{" "}
                  {state.missing.length
                    ? `Missing ${state.missing.join(", ")}`
                    : state.ready
                      ? "Ready"
                      : "Permissions granted; plan required"}
                </s-text>
              </s-box>
            ))}
            <s-text>
              Optional page/article and file pickers require their listed read
              permissions. If a scope is absent from the configured app, its
              picker stays unavailable. Request permission updates through
              Shopify’s app installation flow; no production scopes are changed
              by this page.
            </s-text>
            <s-button
              onClick={() => load(`/app/api/diagnostics${location.search}`)}
            >
              Refresh diagnostics
            </s-button>
            <s-button
              onClick={async () => {
                try {
                  setPermissionError("");
                  const missing = [
                    ...new Set([
                      ...info.features.values.missing,
                      ...info.features.metaobjects.missing,
                    ]),
                  ];
                  if (missing.length) await shopify.scopes.request(missing);
                  load(`/app/api/diagnostics${location.search}`);
                } catch {
                  setPermissionError(
                    "Shopify could not grant the configured permissions. Ask the store owner to reopen or update the app installation, then refresh diagnostics.",
                  );
                }
              }}
            >
              Request configured product / metaobject permissions
            </s-button>
            {permissionError && (
              <s-banner tone="critical">{permissionError}</s-banner>
            )}
            <s-button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(info, null, 2),
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              Copy support diagnostics
            </s-button>
            {copied && (
              <s-text>Copied. No tokens or session values are included.</s-text>
            )}
          </>
        )}
      </s-section>
      <s-section heading="Recovery and data">
        <s-text>
          If a value changed, reload it before saving. Import jobs are
          shop-isolated, expire after seven days and run in bounded chunks.
          Reload the saved job to resume. Before-snapshot export can restore
          existing values through a fresh preview; newly created values require
          selected manual removal. Removing a job clears its saved data without
          reverting Shopify writes.
        </s-text>
        <s-text>
          Metaobject field types/keys stay fixed. Definition metadata can
          change; deletion requires an empty definition. Deleted entries may
          leave reference fields empty. The metaobject API has no atomic
          compare-digest update, so a last-read timestamp detects prior changes
          but cannot eliminate every simultaneous external edit.
        </s-text>
      </s-section>
    </s-page>
  );
}
