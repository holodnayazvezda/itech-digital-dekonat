import { createPortal } from "react-dom";
import { createElement, useEffect, useRef, useState } from "react";

export const afterPaint = (callback) =>
  new Promise((resolve) => requestAnimationFrame(() => resolve(callback?.())));
export function useMount(callback) {
  useEffect(() => {
    void callback();
  }, []);
}
export function useCleanup(callback) {
  useEffect(() => () => callback(), []);
}
export function useWatch(source, callback, options = {}) {
  const value = typeof source === "function" ? source() : source.value;
  const mounted = useRef(false);
  useEffect(
    () => {
      if (mounted.current || options.immediate) void callback(value);
      mounted.current = true;
    },
    Array.isArray(value) ? value : [value],
  );
}
export function classNames(...args) {
  return args
    .flatMap((v) =>
      !v
        ? []
        : typeof v === "string"
          ? [v]
          : Array.isArray(v)
            ? classNames(...v)
            : Object.keys(v).filter((k) => v[k]),
    )
    .join(" ");
}
export function Dynamic({ as, ...attrs }) {
  return createElement(as, attrs);
}
export function Icon({ icon }) {
  return (
    <svg className="v-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={icon} />
    </svg>
  );
}
export function IconButton({ icon, variant, children, ...props }) {
  return (
    <button
      type="button"
      className={classNames("v-btn", icon && "icon-button")}
      {...props}
    >
      {children}
    </button>
  );
}
export function Dialog({
  id,
  open,
  onClose,
  maxWidth = 480,
  children,
  label = "Карточка кабинета",
  className = "",
  focusSelf = false,
}) {
  const element = useRef(null);
  const pressedBackdrop = useRef(false);
  function onBackdrop(event) {
    if (event.target !== element.current) return false;
    const bounds = element.current.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX >= bounds.right ||
      event.clientY < bounds.top || event.clientY >= bounds.bottom;
  }
  useEffect(() => {
    const dialog = element.current;
    if (open && !dialog.open) {
      dialog.showModal();
      if (focusSelf) dialog.focus({ preventScroll: true });
    }
    if (!open && dialog.open) dialog.close();
  }, [open, focusSelf]);
  return (
    <dialog
      id={id}
      ref={element}
      className={"campus-dialog " + className}
      aria-label={label}
      tabIndex={focusSelf ? -1 : undefined}
      style={{ maxWidth }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={event => { pressedBackdrop.current = onBackdrop(event); }}
      onClick={event => {
        if (pressedBackdrop.current && onBackdrop(event)) onClose();
        pressedBackdrop.current = false;
      }}
    >
      {open && children}
    </dialog>
  );
}
export function Toast({ open, onClose, timeout, children }) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) { setPresent(true); return; }
    const timer = setTimeout(() => setPresent(false), 180);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, timeout);
    return () => clearTimeout(timer);
  }, [open, timeout, children]);
  if (!open && !present) return null;
  const notice = (
    <div role="status" className={"campus-toast" + (!open ? " toast-exiting" : "")}>
      {children}
    </div>
  );
  const dialog = document.querySelector("dialog[open]");
  return dialog ? createPortal(notice, dialog) : notice;
}
