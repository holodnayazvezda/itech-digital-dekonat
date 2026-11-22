import { useSyncExternalStore } from "react";
import "./phone-navigation.css";

const phoneQuery = "(max-width: 640px)";

function subscribe(onChange) {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const matchesPhone = () => window.matchMedia(phoneQuery).matches;

export function usePhoneLayout() {
  return useSyncExternalStore(subscribe, matchesPhone);
}

export function PhoneNavigatorIcon({ size = 25, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M19.8 3.7Q21 3.1 20.4 4.3L13.7 19.9Q13.2 21.1 12.8 19.8L10.9 13.9Q10.7 13.3 10.1 13.1L4.2 11.2Q2.9 10.8 4.1 10.3Z" />
  </svg>;
}

export default function PhoneNavigation({ items, assistant }) {
  return (
    <nav className="phone-navigation" aria-label="Навигация кабинета">
      {items.map(({ label, Icon, active, onSelect }) => (
        <button type="button" className="phone-nav-button" key={label} onClick={onSelect}
          aria-label={label} title={label} aria-current={active ? "page" : undefined}>
          <span className="phone-nav-icon"><Icon size={25} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" /></span>
        </button>
      ))}
      {assistant}
    </nav>
  );
}
