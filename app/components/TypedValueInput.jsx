import ActionButton from "./ActionButton";
import { useState } from "react";
import PropTypes from "prop-types";
import { validationPresentation } from "./ValidationEditor";
import { REFERENCE_TYPES, valueInputHint } from "../value-types";

export default function TypedValueInput({
  type,
  value,
  onChange,
  validations = [],
  references = [],
  onFindReferences,
  referencesLoading = false,
}) {
  const [search, setSearch] = useState("");
  const base = type.replace(/^list\./, ""),
    isList = type.startsWith("list.");
  const addReference = (id) => {
    if (!isList) {
      onChange(id);
      return;
    }
    let items;
    try {
      items = JSON.parse(value || "[]");
    } catch {
      items = [];
    }
    if (!Array.isArray(items)) items = [];
    onChange(JSON.stringify([...new Set([...items, id])]));
  };
  return (
    <>
      <s-text>{valueInputHint(type)}</s-text>
      {validations.length > 0 && (
        <div className="vsn-value-rules">
          <strong>Value validation</strong>
          <ul>
            {validations.map((rule) => (
              <li key={rule.name}>
                {validationPresentation(rule, type).label}: {rule.value}
              </li>
            ))}
          </ul>
          <p className="vsn-field-details">
            Values must meet these definition rules before saving.
          </p>
        </div>
      )}

      {type === "boolean" ? (
        <s-select
          label="Value"
          value={value}
          onInput={(e) => onChange(e.target.value)}
        >
          <s-option value="">Choose a value</s-option>
          <s-option value="true">True</s-option>
          <s-option value="false">False</s-option>
        </s-select>
      ) : [
          "single_line_text_field",
          "number_integer",
          "number_decimal",
          "date",
          "date_time",
          "url",
          "color",
        ].includes(type) ? (
        <s-text-field
          label={`Value (${type})`}
          value={value}
          onInput={(e) => onChange(e.target.value)}
        />
      ) : (
        <s-text-area
          label={`Value (${type})`}
          value={value}
          onInput={(e) => onChange(e.target.value)}
        />
      )}
      {REFERENCE_TYPES[base] && onFindReferences && (
        <>
          <s-search-field
            label="Reference search or metaobject type"
            value={search}
            onInput={(e) => setSearch(e.target.value)}
          />
          <ActionButton
            variant="info"
            loading={referencesLoading}
            onClick={() => onFindReferences(base, search)}
          >
            Find references
          </ActionButton>
          <s-select
            label="Add a reference"
            value=""
            onInput={(e) => {
              if (e.target.value) addReference(e.target.value);
            }}
          >
            <s-option value="">Choose a reference</s-option>
            {references.map((item) => (
              <s-option key={item.id} value={item.id}>
                {item.title}
              </s-option>
            ))}
          </s-select>
        </>
      )}
    </>
  );
}
TypedValueInput.propTypes = {
  type: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  validations: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  references: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ),
  onFindReferences: PropTypes.func,
  referencesLoading: PropTypes.bool,
};
