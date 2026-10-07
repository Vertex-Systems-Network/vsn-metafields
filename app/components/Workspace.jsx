import {
  Link,
  useLocation,
  useNavigation,
  useFetchers,
} from "react-router";
import PropTypes from "prop-types";
import { useEffect, useId, useRef, useState } from "react";
import FieldIcon from "./FieldIcon";
import SidebarItem from "./SidebarItem";
import { APP_NAME, APP_VERSION } from "../product-config";
import { LoadingState } from "./LoadingState";
import { AppNameContext } from "./AppIdentity";

export function Workspace({ children, appName = APP_NAME }) {
  const { search } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const workspaceRef = useRef(null);
  const headerRef = useRef(null);
  const menuId = useId();
  useEffect(() => {
    const measure = () => {
      const height = headerRef.current?.getBoundingClientRect().height;
      if (height) workspaceRef.current?.style.setProperty("--vsn-header-height", `${height}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (headerRef.current) observer?.observe(headerRef.current);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const pending = fetchers.filter((fetcher) => fetcher.state !== "idle");
  const busy = navigation.state !== "idle" || pending.length > 0;
  const saving =
    navigation.state === "submitting" ||
    pending.some((f) => f.state === "submitting");
  const routes = [
    ["/app", "Fields & values", "field"],
    ["/app/metaobjects", "Metaobjects", "reference"],
    ["/app/import", "Import & export", "import"],
    ["/app/packages", "Plans", "plans"],
    ["/app/guide", "Help center", "help"],
  ];
  return (
    <div ref={workspaceRef} className={`vsn-workspace${busy ? " is-busy" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <header ref={headerRef} className="vsn-header">
        <Link
          className="vsn-brand"
          to={{ pathname: "/app", search }}
          aria-label={`${appName} home`}
        >
          <span className="vsn-mark" aria-hidden="true">
            V
          </span>
          <span>{appName}</span>
          <span
            className="vsn-version"
            aria-label={`App version ${APP_VERSION}`}
          >
            v{APP_VERSION}
          </span>
        </Link>
        <Link className="vsn-help-link" to={{ pathname: "/app/guide", search }}>
          Need a hand? <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <aside className="vsn-sidebar">
        <button className="vsn-sidebar-collapse" type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed} aria-controls={menuId}
          onClick={() => setCollapsed(!collapsed)}>
          <FieldIcon type={collapsed ? "panel-open" : "panel-close"} />
          <span className="vsn-nav-label">Collapse menu</span>
        </button>
        <nav id={menuId} className="vsn-navigation" aria-label="Workspace">
          {routes.map(([pathname, label, icon]) => (
            <SidebarItem
              key={pathname}
              end={pathname === "/app"}
              to={{ pathname, search }}
              collapsed={collapsed}
              label={label}
              icon={icon}
              onNavigate={() => setMenuOpen(false)}
            />
          ))}
        </nav>
      </aside>
      <div className="vsn-content">
        {busy && (
          <div className="vsn-workspace-progress">
            <LoadingState
              label={saving ? "Saving changes…" : "Loading workspace…"}
            />
          </div>
        )}
        <main id="workspace-content" aria-busy={busy}>
          <AppNameContext.Provider value={appName}>{children}</AppNameContext.Provider>
        </main>
        <footer className="vsn-footer">
          <span>{appName}</span>
          <Link to={{ pathname: "/app/guide", search }}>
            Guides & troubleshooting
          </Link>
        </footer>
      </div>
    </div>
  );
}
Workspace.propTypes = { children: PropTypes.node, appName: PropTypes.string };

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
