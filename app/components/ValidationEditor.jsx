import { useId } from "react";
import PropTypes from "prop-types";

const titles = {
  "list.min": "Minimum list items",
  "list.max": "Maximum list items",
  max_precision: "Maximum decimal places",
  regex: "Pattern (regular expression)",
  choices: "Allowed choices",
  allowed_domains: "Allowed domains",
  file_type_options: "Allowed file types",
  metaobject_definition_id: "Metaobject definition ID",
  metaobject_definition_ids: "Metaobject definition IDs",
};
export function validationPresentation(rule, type) {
  const base = type.replace(/^list\./, "");
  const text = ["single_line_text_field", "multi_line_text_field"].includes(
    base,
  );
  const measurement = ["weight", "volume", "dimension"].includes(base);
  const list =
    rule.type?.startsWith("list.") ||
    [
      "choices",
      "allowed_domains",
      "file_type_options",
      "metaobject_definition_ids",
    ].includes(rule.name);
  const bound = rule.name === "min" || rule.name === "max";
  return {
    label:
      titles[rule.name] ||
      (bound
        ? `${rule.name === "min" ? "Minimum" : "Maximum"} ${text ? "characters" : base === "date" ? "date" : base === "date_time" ? "date and time" : "value"}`
        : rule.name.replaceAll("_", " ")),
    list,
    multiline: list || (bound && measurement) || rule.name === "schema",
    details: list
      ? "One item per line."
      : bound && measurement
        ? 'JSON with value and unit, for example {"value":10,"unit":"g"}.'
        : rule.name === "regex"
          ? "Shopify checks this pattern when values are saved."
          : "Leave blank for no restriction. Shopify checks the rule when you save.",
  };
}
export default function ValidationEditor({
  type,
  supported = [],
  value,
  onChange,
  disabled = false,
}) {
  const id = useId();
  let rules = [],
    error;
  try {
    rules = JSON.parse(value || "[]");
    if (
      !Array.isArray(rules) ||
      rules.some(
        (r) => !r || typeof r.name !== "string" || typeof r.value !== "string",
      )
    )
      throw Error();
  } catch {
    error =
      "Validation JSON must be an array of name/value strings. Correct it below to use the controls.";
  }
  const change = (name, draft, list) => {
    const next = rules.filter((r) => r.name !== name);
    if (draft !== "")
      next.push({
        name,
        value: list ? JSON.stringify(draft.split("\n")) : draft,
      });
    onChange(JSON.stringify(next));
  };
  return (
    <div className="vsn-validation-editor">
      <h4>Value validation</h4>
      <p className="vsn-field-details">
        Set the values this field accepts. Rules apply to each saved value
        {type.startsWith("list.") ? " and to the list size" : ""}.
      </p>
      {error && (
        <p className="vsn-notice error" role="alert">
          {error}
        </p>
      )}
      {!supported.length && (
        <p className="vsn-field-details">
          No configurable validation rules are available for this type.
        </p>
      )}
      <div className="vsn-validation-grid">
        {supported.map((rule, index) => {
          const presentation = validationPresentation(rule, type);
          let draft = rules.find((r) => r.name === rule.name)?.value || "";
          if (presentation.list && draft) {
            try {
              const parsed = JSON.parse(draft);
              if (Array.isArray(parsed)) draft = parsed.join("\n");
            } catch {
              /* Keep original text available for repair. */
            }
          }
          const controlAttributes = {
            id: `${id}-${index}`,
            value: draft,
            disabled: disabled || Boolean(error),
            "aria-describedby": `${id}-${index}-help`,
            onChange: (e) =>
              change(rule.name, e.target.value, presentation.list),
          };
          return (
            <div key={rule.name} className="vsn-validation-field">
              <label className="vsn-field-label" htmlFor={controlAttributes.id}>
                {presentation.label}
              </label>
              {presentation.multiline ? (
                <textarea {...controlAttributes} rows={3} />
              ) : (
                <input {...controlAttributes} type="text" />
              )}
              <p id={`${id}-${index}-help`} className="vsn-field-details">
                {presentation.details}
              </p>
            </div>
          );
        })}
      </div>
      <details>
        <summary>Advanced validation JSON</summary>
        <div className="vsn-validation-field">
          <label className="vsn-field-label" htmlFor={`${id}-json`}>
            Validation rules (JSON)
          </label>
          <textarea
            id={`${id}-json`}
            rows={4}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </details>
    </div>
  );
}
ValidationEditor.propTypes = {
  type: PropTypes.string.isRequired,
  supported: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
    }),
  ),
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
