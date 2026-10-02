import {
  Link,
  NavLink,
  useLocation,
  useNavigation,
  useFetchers,
} from "react-router";
import PropTypes from "prop-types";
import { APP_NAME } from "../product-config";
import { LoadingState } from "./LoadingState";

export function Workspace({ children }) {
  const { search } = useLocation();
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const pending = fetchers.filter((fetcher) => fetcher.state !== "idle");
  const busy = navigation.state !== "idle" || pending.length > 0;
  const saving =
    navigation.state === "submitting" ||
    pending.some((f) => f.state === "submitting");
  const routes = [
    ["/app", "Fields & values"],
    ["/app/metaobjects", "Metaobjects"],
    ["/app/import", "Import & export"],
    ["/app/packages", "Plans"],
    ["/app/guide", "Help center"],
  ];
  return (
    <div className="vsn-workspace">
      <header className="vsn-header">
        <Link
          className="vsn-brand"
          to={{ pathname: "/app", search }}
          aria-label={`${APP_NAME} home`}
        >
          <span className="vsn-mark" aria-hidden="true">
            V
          </span>
          <span>{APP_NAME}</span>
        </Link>
        <Link className="vsn-help-link" to={{ pathname: "/app/guide", search }}>
          Need a hand? <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <nav className="vsn-navigation" aria-label="Workspace">
        {routes.map(([pathname, label]) => (
          <NavLink
            key={pathname}
            end={pathname === "/app"}
            to={{ pathname, search }}
            className={({ isActive }) =>
              isActive ? "vsn-nav-link active" : "vsn-nav-link"
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {busy && (
        <div className="vsn-workspace-progress">
          <LoadingState
            label={saving ? "Saving changes…" : "Loading workspace…"}
          />
        </div>
      )}
      <main id="workspace-content" aria-busy={busy}>
        {children}
      </main>
      <footer className="vsn-footer">
        <span>{APP_NAME}</span>
        <Link to={{ pathname: "/app/guide", search }}>
          Guides & troubleshooting
        </Link>
      </footer>
    </div>
  );
}
Workspace.propTypes = { children: PropTypes.node };

export function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className="vsn-intro">
      <div>
        <p className="vsn-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="vsn-intro-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
PageIntro.propTypes = {
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node,
};

export function HelpLink({ topic, children = "How does this work?" }) {
  const { search } = useLocation();
  return (
    <Link
      className="vsn-context-help"
      to={{ pathname: "/app/guide", search, hash: topic ? `#${topic}` : "" }}
    >
      {children} <span aria-hidden="true">↗</span>
    </Link>
  );
}
HelpLink.propTypes = { topic: PropTypes.string, children: PropTypes.node };
