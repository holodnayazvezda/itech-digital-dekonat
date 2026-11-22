import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import { Dialog } from "./ui.jsx";

export default function SettingsMenu({ themeButton, children, phone = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const popover = useRef(null);
  function dismiss() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({preventScroll:true}));
  }
  useEffect(() => {
    if (!open) return;
    popover.current?.focus({preventScroll:true});
    const outside = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const Panel = phone ? Dialog : "section";
  return <div className={phone ? "settings-bubble phone-settings" : "settings-bubble"} ref={root} role="group" aria-label="Оформление и настройки">
    {!phone && themeButton}
    <button type="button" aria-haspopup="dialog" ref={trigger} onClick={() => setOpen(!open)}
      aria-label="Настройки" aria-expanded={open} aria-controls={open ? "campus-settings" : undefined}>
      <Settings size={20} strokeWidth={1.6} aria-hidden="true" />
    </button>
    {open && <Panel {...(phone ? {open, onClose:dismiss, maxWidth:"none", label:"Настройки", focusSelf:true} : {ref:popover, tabIndex:-1, role:"dialog", "aria-label":"Настройки"})} id="campus-settings" className="settings-popover">
      <div className="settings-popover-heading">
        <strong>Настройки</strong>
        <button onClick={dismiss} aria-label="Закрыть настройки" className="popover-close"><X size={18} strokeWidth={1.7} /></button>
      </div>
      {phone && <div className="phone-settings-theme">{themeButton}</div>}
      {children(dismiss)}
    </Panel>}
  </div>;
}

export function DemoTimeInput({ value, onChange }) {
  const [hours, setHours] = useState(value.slice(0, 2));
  const [minutes, setMinutes] = useState(value.slice(3));
  useEffect(() => {
    setHours(value.slice(0, 2));
    setMinutes(value.slice(3));
  }, [value]);
  function commit() {
    if (/^\d{1,2}$/.test(hours) && /^\d{1,2}$/.test(minutes) && Number(hours) < 24 && Number(minutes) < 60) {
      const formatted = hours.padStart(2, "0") + ":" + minutes.padStart(2, "0");
      onChange(formatted);
      setHours(formatted.slice(0, 2));
      setMinutes(formatted.slice(3));
    } else {
      setHours(value.slice(0, 2));
      setMinutes(value.slice(3));
    }
  }
  return <div className="demo-time-input" role="group" aria-label="Демо-время">
    <input aria-label="Часы демо-времени" inputMode="numeric" type="text" maxLength={2} value={hours} onChange={e => setHours(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={e => {if (e.key === "Enter") e.currentTarget.blur();}} />
    <span aria-hidden="true">:</span>
    <input aria-label="Минуты демо-времени" inputMode="numeric" type="text" maxLength={2} value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={e => {if (e.key === "Enter") e.currentTarget.blur();}} />
    <span className="demo-time-format">24 ч</span>
  </div>;
}
