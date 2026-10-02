import PropTypes from "prop-types";

export function LoadingState({
  label = "Loading workspace…",
  skeleton = false,
}) {
  return (
    <div
      className={`vsn-loading-state ${skeleton ? "screen" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="vsn-loading-label">
        <span className="vsn-spinner" aria-hidden="true" />
        {label}
      </div>
      {skeleton && (
        <div className="vsn-skeleton" aria-hidden="true">
          <span />
          <span />
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
LoadingState.propTypes = { label: PropTypes.string, skeleton: PropTypes.bool };
