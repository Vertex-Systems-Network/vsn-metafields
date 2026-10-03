import PropTypes from "prop-types";

const paths = {
  text: "M5 18 10 5h2l5 13M7 13h8",
  lines: "M4 6h16M4 10h16M4 14h11M4 18h8",
  number: "m9 3-3 18m12-18-3 18M3 9h18M2 15h18",
  calendar: "M4 5h16v15H4zM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  reference: "M3 15h6v6H3zM15 15h6v6h-6zM9 3h6v6H9zM12 9v3m-6 3v-3h12v3",
  link: "m9 15 6-6m-6 8-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  measure: "m3 16 13-13 5 5L8 21zM12 7l2 2m-6 2 2 2m-6 2 2 2",
  toggle:
    "M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6zM8 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  color: "M12 3s7 8 7 12a7 7 0 0 1-14 0c0-4 7-12 7-12z",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16",
  field: "M4 4h16v16H4zM8 9h8m-8 6h5",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",
  chevron: "m6 9 6 6 6-6",
  "panel-open": "M3 4h18v16H3zM8 4v16m5-11 3 3-3 3",
  "panel-close": "M3 4h18v16H3zM8 4v16m8-11-3 3 3 3",
  menu: "M4 6h16M4 12h16M4 18h16",
  import: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  plans: "M4 5h16v14H4zM4 10h16M8 15h4",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
};
export default function FieldIcon({ type = "field" }) {
  return (
    <svg
      className="vsn-field-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[type] || paths.field} />
    </svg>
  );
}
FieldIcon.propTypes = { type: PropTypes.string };
