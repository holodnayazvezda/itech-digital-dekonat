import { useRef, useLayoutEffect } from "react";
export default function useActiveNavigation({
  role,
  tab,
  panel,
  phone
}) {
  const navRef = useRef(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const selected = nav.querySelector('[aria-current="page"]');
    if (!selected) {
      delete nav.dataset.measured;
      return;
    }
    function alignIndicator() {
      const navBox = nav.getBoundingClientRect();
      const box = selected.getBoundingClientRect();
      nav.style.setProperty("--active-left", box.left - navBox.left + "px");
      nav.style.setProperty("--active-width", box.width + "px");
      nav.dataset.measured = "true";
    }
    alignIndicator();
    const resize = new ResizeObserver(alignIndicator);
    resize.observe(nav);
    for (const item of nav.children) resize.observe(item);
    return () => resize.disconnect();
  }, [role.value, tab.value, panel.value, phone]);
  return navRef;
}
