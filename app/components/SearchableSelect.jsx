import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import FieldIcon from "./FieldIcon";

// A single selected value with a searchable, grouped listbox. Values stay
// canonical; presentation labels/icons never change the value sent to Shopify.
export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Choose an option",
  searchPlaceholder = "Search options",
  details,
}) {
  const id = useId();
  const root = useRef(null),
    trigger = useRef(null),
    input = useRef(null);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState("");
  const selected = options.find((option) => option.value === value);
  const query = search.trim().toLowerCase();
  const matching = options.filter((option) =>
    `${option.label} ${option.group || ""} ${option.badge || ""} ${option.keywords || ""}`
      .toLowerCase()
      .includes(query),
  );
  const visible = matching.slice(0, 200);
  if (!query && selected && !visible.includes(selected))
    visible.splice(0, 1, selected);
  const groups = [...new Set(visible.map((option) => option.group || ""))];
  const grouped = groups.flatMap((group) =>
    visible.filter((option) => (option.group || "") === group),
  );
  const enabled = grouped.filter((option) => !option.disabled);
  const highlighted =
    enabled.find((option) => option.value === active) || enabled[0];
  const optionId = (option) => `${id}-option-${options.indexOf(option)}`;
  const highlightedId = highlighted ? optionId(highlighted) : undefined;
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && highlightedId)
      document
        .getElementById(highlightedId)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedId]);
  const choose = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    close(true);
  };
  const move = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlighted) choose(highlighted);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const index = enabled.indexOf(highlighted);
      const next = Math.max(
        0,
        Math.min(
          enabled.length - 1,
          index + (event.key === "ArrowDown" ? 1 : -1),
        ),
      );
      setActive(enabled[next]?.value || "");
    }
  };
  return (
    <div
      className="vsn-searchable-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <span id={`${id}-label`} className="vsn-field-label">
        {label}
      </span>
      <button
        ref={trigger}
        className="vsn-select-trigger"
        type="button"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-describedby={details ? `${id}-details` : undefined}
        onClick={() => {
          setSearch("");
          setActive(value);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setSearch("");
            setActive(value);
            setOpen(true);
          }
        }}
      >
        {selected?.badge && (
          <span className="vsn-type-badge">{selected.badge}</span>
        )}
        {selected?.icon && <FieldIcon type={selected.icon} />}
        <span id={`${id}-value`}>{selected?.label || placeholder}</span>
        <span className="vsn-select-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {details && (
        <p id={`${id}-details`} className="vsn-field-details">
          {details}
        </p>
      )}
      {open && (
        <div className="vsn-select-popover">
          <div className="vsn-select-search">
            <FieldIcon type="search" />
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={
                highlighted ? optionId(highlighted) : undefined
              }
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive("");
              }}
              onKeyDown={move}
            />
          </div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="vsn-select-options"
          >
            {groups.map((group) => (
              <div key={group} role="group" aria-label={group || label}>
                {group && (
                  <div className="vsn-select-group" aria-hidden="true">
                    {group}
                  </div>
                )}
                {visible
                  .filter((option) => (option.group || "") === group)
                  .map((option) => (
                    <button
                      type="button"
                      role="option"
                      tabIndex={-1}
                      key={option.value}
                      id={optionId(option)}
                      aria-selected={value === option.value}
                      aria-disabled={option.disabled || undefined}
                      className={`vsn-select-option${highlighted?.value === option.value ? " highlighted" : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                    >
                      {option.icon && <FieldIcon type={option.icon} />}
                      <span>{option.label}</span>
                      {option.badge && (
                        <span className="vsn-type-badge">{option.badge}</span>
                      )}
                      {value === option.value && (
                        <span className="vsn-option-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="vsn-select-result-count" role="status">
            {!matching.length
              ? "No matching options. Try another search."
              : matching.length > 200
                ? `Showing 200 of ${matching.length}. Search to narrow the list.`
                : `${matching.length} options`}
          </div>
        </div>
      )}
    </div>
  );
}
SearchableSelect.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      group: PropTypes.string,
      icon: PropTypes.string,
      badge: PropTypes.string,
      keywords: PropTypes.string,
      disabled: PropTypes.bool,
    }),
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  details: PropTypes.string,
};
