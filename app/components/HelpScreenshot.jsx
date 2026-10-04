import PropTypes from "prop-types";

export function HelpScreenshot({ screenshot }) {
  return (
    <figure className="vsn-guide-preview vsn-help-screenshot">
      <h4>{screenshot.title}</h4>
      <a
        href={screenshot.src}
        target="_blank"
        rel="noreferrer"
        aria-label={`Enlarge ${screenshot.title} screenshot`}
      >
        <img
          src={screenshot.src}
          alt={screenshot.alt}
          width={screenshot.width}
          height={screenshot.height}
          loading="lazy"
        />
      </a>
      <figcaption>
        Actual Staging app · v{screenshot.version} · captured{" "}
        {screenshot.capturedAt.slice(0, 10)} · select image to enlarge. Labels may
        change in later versions.
      </figcaption>
      <ol>
        {screenshot.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </figure>
  );
}

HelpScreenshot.propTypes = {
  screenshot: PropTypes.shape({
    src: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    alt: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    capturedAt: PropTypes.string.isRequired,
    version: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};
