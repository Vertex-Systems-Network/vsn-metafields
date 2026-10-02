import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { HELP_TOPICS } from "../help-content";
import { PageIntro } from "../components/Workspace";
export default function Guide() {
  const diagnostics = useFetcher(),
    location = useLocation(),
    [copied, setCopied] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [search, setSearch] = useState("");
  const matches = HELP_TOPICS.filter((topic) =>
    JSON.stringify(topic).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const load = diagnostics.load;
  useEffect(() => {
    load(`/app/api/diagnostics${location.search}`);
  }, [load, location.search]);
  const info = diagnostics.data?.diagnostics;
  return (
    <s-page heading="Help center">
      <PageIntro
        eyebrow="Guides & support"
        title="A little guidance. A smoother workflow."
        description="Step-by-step answers for setting up content, choosing a plan and solving common problems."
      />
      <label htmlFor="help-search">Search guides and troubleshooting</label>
      <input
        id="help-search"
        className="vsn-help-search"
        type="search"
        placeholder="Try: CSV, public access, billing or theme blocks"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div aria-live="polite" className="vsn-context-help">
        {matches.length} guides found
      </div>
      <div className="vsn-help-grid">
        {matches.map((topic) => (
          <article id={topic.id} className="vsn-help-topic" key={topic.id}>
            <h2>{topic.title}</h2>
            <p>{topic.description}</p>
            <ol>
              {topic.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {topic.faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
            <Link
              className="vsn-context-help"
              to={{
                pathname: topic.link.split("#")[0],
                search: location.search,
                hash: topic.link.includes("#")
                  ? `#${topic.link.split("#")[1]}`
                  : "",
              }}
            >
              {topic.action} <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>
      {!matches.length && (
        <div className="vsn-empty">
          <h3>No matching guide</h3>
          <p>
            Try a shorter search, or check your connection diagnostics below.
          </p>
          <button className="vsn-button" onClick={() => setSearch("")}>
            Show all guides
          </button>
        </div>
      )}
      <div id="connection" />
      <s-section heading="Connection and permissions">
        {diagnostics.state !== "idle" && (
          <div className="vsn-loading" role="status">
            Checking your connection and permissions…
          </div>
        )}
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
    </s-page>
  );
}
