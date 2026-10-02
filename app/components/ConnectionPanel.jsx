import PropTypes from "prop-types";
import { REFERENCE_PERMISSIONS } from "../permission-client";
import { LoadingState } from "./LoadingState";

const CORE = {
  values: {
    label: "Product & collection values",
    purpose: "Read and save supported typed values.",
  },
  metaobjects: {
    label: "Reusable metaobjects",
    purpose: "Manage definitions and content entries.",
  },
};
export function ConnectionPanel({
  info,
  checking,
  error,
  onRefresh,
  onRequest,
  requesting,
  permissionMessage,
  onCopy,
  copied,
}) {
  const features = info?.features || {};
  return (
    <section
      id="connection"
      className="vsn-panel"
      aria-labelledby="connection-heading"
    >
      <div className="vsn-panel-heading">
        <div>
          <p className="vsn-eyebrow">Store connection</p>
          <h2 id="connection-heading">Connection and permissions</h2>
          <p>See what is ready and enable the reference tools you need.</p>
        </div>
        <button
          className="vsn-button secondary"
          disabled={checking || Boolean(requesting)}
          onClick={onRefresh}
        >
          Refresh status
        </button>
      </div>
      {(checking || (!info && !error)) && (
        <LoadingState
          label="Checking your connection and permissions…"
          skeleton={!info}
        />
      )}
      {error && (
        <div className="vsn-notice error" role="alert">
          {error}
        </div>
      )}
      {info && (
        <>
          <dl className="vsn-connection-metrics">
            <div>
              <dt>Environment</dt>
              <dd>{info.environment}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{info.database}</dd>
            </div>
            <div>
              <dt>Subscription</dt>
              <dd>{info.hasActivePlan ? "Active" : "Plan required"}</dd>
            </div>
            <div>
              <dt>Saved imports</dt>
              <dd>{info.importJobCount ?? 0}</dd>
            </div>
          </dl>
          <div className="vsn-permission-grid">
            {Object.entries({ ...CORE, ...REFERENCE_PERMISSIONS }).map(
              ([key, details]) => {
                const state = features[key];
                if (!state) return null;
                const missing = state.missing || [];
                const optional = Boolean(REFERENCE_PERMISSIONS[key]);
                return (
                  <article className="vsn-permission-card" key={key}>
                    <div className="vsn-card-heading">
                      <h3>{details.label}</h3>
                      <span
                        className={`vsn-badge ${state.ready ? "ready" : "attention"}`}
                      >
                        {state.ready
                          ? "Ready"
                          : missing.length
                            ? "Permission needed"
                            : "Plan required"}
                      </span>
                    </div>
                    <p>{details.purpose}</p>
                    {missing.length > 0 && (
                      <p className="vsn-permission-note">
                        {optional
                          ? "Approve read access in Shopify to use this picker."
                          : "Ask the store owner to reopen or update the app installation."}
                      </p>
                    )}
                    {optional && missing.length > 0 && (
                      <button
                        className="vsn-button primary"
                        disabled={checking || Boolean(requesting)}
                        onClick={() => onRequest(key)}
                      >
                        {requesting === key
                          ? "Waiting for Shopify…"
                          : details.action}
                      </button>
                    )}
                  </article>
                );
              },
            )}
          </div>
          {permissionMessage && (
            <div
              className={`vsn-notice ${permissionMessage.tone || ""}`}
              role="status"
            >
              {permissionMessage.text}
            </div>
          )}
          <div className="vsn-action-row">
            <button className="vsn-button secondary" onClick={onCopy}>
              {copied ? "Diagnostics copied" : "Copy support diagnostics"}
            </button>
            <span className="vsn-context-help">
              No tokens or session values are included.
            </span>
          </div>
          <details className="vsn-technical-details">
            <summary>Technical connection details</summary>
            <p>API {info.apiVersion}</p>
            {Object.entries(features).map(([key, state]) => (
              <p key={key}>
                {key}:{" "}
                {(state.missing || []).length
                  ? `Missing ${state.missing.join(", ")}`
                  : "Permissions granted"}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
ConnectionPanel.propTypes = {
  info: PropTypes.object,
  checking: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func.isRequired,
  onRequest: PropTypes.func.isRequired,
  requesting: PropTypes.string,
  permissionMessage: PropTypes.object,
  onCopy: PropTypes.func.isRequired,
  copied: PropTypes.bool,
};
