import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import PropTypes from "prop-types";
import FieldIcon from "./FieldIcon";

export default function SidebarItem({
  to,
  end,
  collapsed,
  label,
  icon,
  onNavigate = () => {},
}) {
  const link = useRef(null),
    timer = useRef(null),
    hoveringTip = useRef(false);
  const id = useId();
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState(null);
  const keep = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    keep();
    if (collapsed && window.matchMedia("(min-width: 701px)").matches)
      setOpen(true);
  };
  const hide = () => {
    keep();
    if (document.activeElement === link.current || hoveringTip.current) return;
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => {
    if (!collapsed) {
      hoveringTip.current = false;
      setOpen(false);
    }
  }, [collapsed]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = link.current?.getBoundingClientRect();
      if (!rect || !window.matchMedia("(min-width: 701px)").matches) {
        setOpen(false);
        return;
      }
      setPosition({
        left: rect.right + 10,
        top: Math.max(
          8,
          Math.min(rect.top + rect.height / 2, window.innerHeight - 24),
        ),
      });
    };
    const dismiss = (event) => {
      if (event.key === "Escape") {
        hoveringTip.current = false;
        keep();
        setOpen(false);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    document.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open]);
  return (
    <>
      <NavLink
        ref={link}
        to={to}
        end={end}
        className={({ isActive }) =>
          isActive ? "vsn-nav-link active" : "vsn-nav-link"
        }
        aria-label={label}
        aria-describedby={open && position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          hoveringTip.current = false;
          keep();
          setOpen(false);
          onNavigate();
        }}
      >
        <FieldIcon type={icon} />
        <span className="vsn-nav-label">{label}</span>
      </NavLink>
      {open &&
        position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="vsn-sidebar-tooltip"
            style={position}
            onMouseEnter={() => {
              hoveringTip.current = true;
              keep();
            }}
            onMouseLeave={() => {
              hoveringTip.current = false;
              hide();
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
SidebarItem.propTypes = {
  to: PropTypes.object.isRequired,
  end: PropTypes.bool,
  collapsed: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
};
