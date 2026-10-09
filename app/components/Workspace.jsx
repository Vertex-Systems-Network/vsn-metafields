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
import { APP_NAME, appEnvironmentTag, LIVE_APP_VERSION } from "../product-config";
import { getWorkspaceContentLayout } from "../workspace-content-layout";
import { LoadingState } from "./LoadingState";
import { AppNameContext } from "./AppIdentity";

export function Workspace({ children, appName = APP_NAME, environment = "development" }) {
  const { search } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const workspaceRef = useRef(null);
  const mainRef = useRef(null);
  const headerRef = useRef(null);
  const menuId = useId();
  const environmentTag = appEnvironmentTag(environment);
  const isLive = environmentTag === "ver";
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

  useEffect(() => {
    const main = mainRef.current;
    const content = main?.closest(".vsn-content");
    if (!main || !content) return;

    const originalStyles = new Map();
    const getPages = () =>
      Array.from(main.children).filter((child) => child.tagName === "S-PAGE");
    const getPageChildren = () =>
      getPages().flatMap((page) => Array.from(page.children));
    const remember = (child) => {
      if (!originalStyles.has(child)) {
        originalStyles.set(child, {
          inlineSize: child.style.inlineSize,
          maxInlineSize: child.style.maxInlineSize,
          transform: child.style.transform,
        });
      }
    };
    const restore = (child) => {
      const original = originalStyles.get(child);
      if (!original) return;
      child.style.inlineSize = original.inlineSize;
      child.style.maxInlineSize = original.maxInlineSize;
      child.style.transform = original.transform;
    };
    const applyContentGutters = () => {
      const children = getPageChildren();
      if (window.innerWidth <= 900) {
        children.forEach(restore);
        return;
      }

      const contentRect = content.getBoundingClientRect();
      for (const child of children) {
        remember(child);
        child.style.transform = "none";
        const layout = getWorkspaceContentLayout({
          contentLeft: contentRect.left,
          contentWidth: contentRect.width,
          bodyLeft: child.getBoundingClientRect().left,
        });
        child.style.inlineSize = `${layout.inlineSize}px`;
        child.style.maxInlineSize = "none";
        child.style.transform = `translateX(${layout.translateX}px)`;
      }
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applyContentGutters);
    const observePages = () => getPages().forEach((page) => resizeObserver?.observe(page));
    resizeObserver?.observe(content);
    resizeObserver?.observe(main);
    observePages();
    applyContentGutters();

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            observePages();
            applyContentGutters();
          });
    mutationObserver?.observe(main, { childList: true, subtree: true });
    window.addEventListener("resize", applyContentGutters);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", applyContentGutters);
      getPageChildren().forEach(restore);
    };
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
    ["/app/privacy", "Privacy requests", "help"],
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
          {isLive ? (
            <span className="vsn-version" aria-label={`App version ${LIVE_APP_VERSION}`}>
              v{LIVE_APP_VERSION}
            </span>
          ) : (
            <span className="vsn-environment" aria-label={`Environment ${environmentTag}`}>
              {environmentTag === "stag" ? "Stag" : "Dev"}
            </span>
          )}
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
              onNavigate={() => setCollapsed(false)}
              label={label}
              icon={icon}
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
        <main id="workspace-content" ref={mainRef} aria-busy={busy}>
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
Workspace.propTypes = {
  children: PropTypes.node,
  appName: PropTypes.string,
  environment: PropTypes.string,
};

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
