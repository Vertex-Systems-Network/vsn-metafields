import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { HELP_TOPICS } from "../help-content";
import { PageIntro } from "../components/Workspace";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { requestReferencePermission } from "../permission-client";
export default function Guide() {
  const diagnostics = useFetcher(),
    location = useLocation(),
    [copied, setCopied] = useState(false);
  const [requesting, setRequesting] = useState("");
  const [permissionMessage, setPermissionMessage] = useState(null);
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
      >
        <a className="vsn-button info" href="#connection">
          Connection & permissions
        </a>
      </PageIntro>
      <s-search-field
        id="help-search"
        label="Search guides and troubleshooting"
        placeholder="Try: CSV, public access, billing or theme blocks"
        value={search}
        onInput={(event) => setSearch(event.currentTarget.value)}
      />
      <div aria-live="polite" className="vsn-context-help">
        {matches.length} guides found
      </div>
      <div className="vsn-help-grid">
        {matches.map((topic) => (
          <article id={topic.id} className="vsn-help-topic" key={topic.id}>
            <h2>{topic.title}</h2>
            <p>{topic.description}</p>
            <p className="vsn-help-location">
              <strong>Where to find it</strong> {topic.where}
            </p>
            <figure className="vsn-guide-preview">
              <a
                href={topic.preview.src}
                target="_blank"
                rel="noreferrer"
                aria-label={`Enlarge ${topic.title} preview`}
              >
                <img
                  src={topic.preview.src}
                  alt={topic.preview.alt}
                  width="960"
                  height="600"
                  loading="lazy"
                />
              </a>
              <figcaption>
                Illustrated walkthrough · example data · select image to enlarge
              </figcaption>
            </figure>
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
      <ConnectionPanel
        info={info}
        checking={diagnostics.state !== "idle"}
        error={diagnostics.data?.error}
        onRefresh={() => load(`/app/api/diagnostics${location.search}`)}
        requesting={requesting}
        permissionMessage={permissionMessage}
        onRequest={async (feature) => {
          if (requesting) return;
          setRequesting(feature);
          setPermissionMessage(null);
          try {
            const result = await requestReferencePermission(
              window.shopify,
              feature,
            );
            setPermissionMessage({
              tone: result === "declined" ? "warning" : "success",
              text:
                result === "declined"
                  ? "Permission was declined. You can keep using the other tools and enable this picker later."
                  : "Shopify confirmed permission. Refreshing the verified connection status…",
            });
            load(`/app/api/diagnostics${location.search}`);
          } catch (error) {
            setPermissionMessage({ tone: "error", text: error.message });
          } finally {
            setRequesting("");
          }
        }}
        copied={copied}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
            setCopied(true);
          } catch {
            setCopied(false);
            setPermissionMessage({
              tone: "error",
              text: "Copy failed. Open technical connection details to share the visible status with support.",
            });
          }
        }}
      />
    </s-page>
  );
}
