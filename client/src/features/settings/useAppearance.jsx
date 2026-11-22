import { flushSync } from "react-dom";
import { Moon, Sun, SunMoon } from "lucide-react";
import palette from "../../shared/styles/palette.json";
import { computed, useSignal } from "@preact/signals-react";
import { useRef, useEffect } from "react";
export default function useAppearance() {
  const themePreference = useSignal(localStorage.getItem("campus-theme") || "System");
  const themeTransition = useRef(null);
  useEffect(() => () => {
    themeTransition.current?.skipTransition();
    document.documentElement.classList.remove("theme-crossfade");
  }, []);
  const theme = useSignal((themePreference.value !== "System" ? themePreference.value : null) || (matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"));
  const colors = computed(() => Object.fromEntries(Object.entries(palette[theme.value] || palette.Light).map(([k, v]) => ["--c-" + k, v])));
  function applyTheme(value, preference) {
    const update = () => flushSync(() => {
      if (preference !== undefined) themePreference.value = preference;
      theme.value = value;
    });
    themeTransition.current?.skipTransition();
    if (theme.value === value || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      return;
    }
    document.documentElement.classList.add("theme-crossfade");
    const transition = document.startViewTransition(update);
    themeTransition.current = transition;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (themeTransition.current !== transition) return;
      themeTransition.current = null;
      document.documentElement.classList.remove("theme-crossfade");
    });
  }
  function setAppearance(value) {
    applyTheme(value === "System" ? matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light" : value, value);
    localStorage.setItem("campus-theme", value);
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => {
      if (themePreference.value === "System") applyTheme(media.matches ? "Dark" : "Light");
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const themeName = {
    Light: "светлая",
    Dark: "тёмная",
    System: "автоматическая"
  }[themePreference.value];
  const ThemeIcon = {
    Light: Sun,
    Dark: Moon,
    System: SunMoon
  }[themePreference.value] || SunMoon;
  return {
    themePreference,
    theme,
    colors,
    themeName,
    ThemeIcon,
    setAppearance
  };
}
