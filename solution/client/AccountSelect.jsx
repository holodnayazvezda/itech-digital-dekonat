import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function AccountSelect({ label, value, options, onChange, showDescription = false }) {
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  function close() {
    setOpen(false);
    trigger.current?.focus({preventScroll:true});
  }
  function show() {
    setActive(selected);
    setOpen(true);
  }
  function choose(option) {
    onChange(option.value);
    close();
  }
  useEffect(() => {
    if (!open) return;
    const outside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    const focusOutside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.focus({preventScroll:true});
  }, [open, active]);
  function navigate(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(options.length - 1);
      else setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  }
  return <div className="account-select" ref={root}>
    <span className="account-select-label" id={id + "-label"}>{label}</span>
    <button type="button" className="account-select-trigger" role="combobox" ref={trigger}
      aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
      onClick={() => open ? close() : show()}
      onKeyDown={event => {
        if (["ArrowDown","ArrowUp"].includes(event.key)) {event.preventDefault();show();}
      }}>
      <span>{options[selected]?.label}{showDescription && <small>{options[selected]?.description}</small>}</span><ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" />
    </button>
    {open && <div id={id} role="listbox" aria-labelledby={id + "-label"} className="account-options" ref={list} onKeyDown={navigate}>
      {options.map((option,index) => <button type="button" key={option.value} role="option"
        aria-selected={option.value === value} tabIndex={active === index ? 0 : -1} data-active={active === index}
        onClick={() => choose(option)} onMouseEnter={() => setActive(index)}>
        <span><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>
        <span className="option-mark" aria-hidden="true">{option.value === value && <Check size={18} strokeWidth={1.6} />}</span>
      </button>)}
    </div>}
  </div>;
}
