import PropTypes from "prop-types";

export default function ActionButton({
  children,
  variant = "secondary",
  tone,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      {...props}
      type="button"
      className={`vsn-button ${tone === "critical" ? "danger" : variant}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading && <span className="vsn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
ActionButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.string,
  tone: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
};
