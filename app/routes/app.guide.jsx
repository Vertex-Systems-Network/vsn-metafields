import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { HELP_TOPICS } from "../help-content";
import { FIRST_FIELD_STEPS, HELP_GLOSSARY } from "../help-details";
import { THEME_HELP } from "../theme-help";
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
    JSON.stringify([topic, topic.id === "storefront" ? THEME_HELP : []])
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const load = diagnostics.load;
  useEffect(() => {
    load(`/app/api/diagnostics${location.search}`);
  }, [load, location.search]);
  const info = diagnostics.data?.diagnostics;
  return (
    <s-page inline-size="large" heading="Help center">
      <PageIntro
        eyebrow="Guides & support"
        title="Start here. Learn each option as you go."
        description="Follow one complete example, then look up any input, button or theme setting. Each guide explains where it is, what it does and how to check the result."
      >
        <a className="vsn-button info" href="#connection">
          Connection & permissions
        </a>
      </PageIntro>
      <section
        className="vsn-help-topic vsn-help-start"
        aria-labelledby="first-field-title"
      >
        <p className="vsn-eyebrow">New to metafields?</p>
        <h2 id="first-field-title">
          Your first example: care instructions on a shirt
        </h2>
        <p>
          You will create a field, save content on one product and connect it to
          a theme block. Start with one product so you can inspect each result.
        </p>
        <ol>
          {FIRST_FIELD_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <details>
          <summary>Use the workspace menu</summary>
          <p>
            On desktop, the wider left menu stays below the app header as you
            scroll. Select Collapse menu for an icon-only menu, or Expand
            navigation to restore names. Hover an icon or focus it with Tab to
            read its tooltip; Escape dismisses the tooltip. The selected page
            stays highlighted. On a small screen, use Workspace menu to show or
            hide navigation above your content.
          </p>
        </details>
        <details>
          <summary>Plain-language glossary</summary>
          <dl className="vsn-help-glossary">
            {HELP_GLOSSARY.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      <nav className="vsn-help-jump" aria-label="Help topics">
        {matches.map((topic) => (
          <a key={topic.id} href={`#${topic.id}`}>
            {topic.title}
          </a>
        ))}
      </nav>
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
            <h3>Follow these steps</h3>
            <ol>
              {topic.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="vsn-help-result">
              <strong>Check the result:</strong> {topic.result}
            </p>
            {topic.sections.map((section) => (
              <details key={section.title}>
                <summary>{section.title}</summary>
                <dl className="vsn-help-controls">
                  {section.rows.map(([label, explanation, example]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <p>{explanation}</p>
                        <p>
                          <strong>Example or check:</strong> {example}
                        </p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
            {topic.id === "storefront" &&
              THEME_HELP.map((block) => (
                <details key={block.id}>
                  <summary>{block.title}: every theme setting</summary>
                  <p>
                    Find these options in Shopify&apos;s theme editor after
                    selecting the {block.title} app block. Settings change this
                    block&apos;s presentation; they do not edit the saved
                    Shopify value.
                  </p>
                  <dl className="vsn-help-controls">
                    {block.settings.map((setting) => (
                      <div key={setting.id}>
                        <dt>{setting.label}</dt>
                        <dd>
                          <p>{setting.description}</p>
                          <p>{setting.details}</p>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            <details>
              <summary>Common mistakes to avoid</summary>
              <ul>
                {topic.mistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </details>
            <details className="vsn-help-illustration">
              <summary>Concept diagram (example data)</summary>
              <p>
                This illustration explains the workflow. It is not a screenshot
                of the current app.
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
                  Concept diagram · example data · select image to enlarge
                </figcaption>
              </figure>
            </details>
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
