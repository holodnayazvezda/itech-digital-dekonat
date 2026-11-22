import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { VApp, VBtn, VDialog, VIcon, VSnackbar } from "vuetify/components";
import { Ripple } from "vuetify/directives";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import "vuetify/styles";
import "@fontsource/pt-serif/latin-400.css";
import "@fontsource/pt-serif/cyrillic-400.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/cyrillic-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/cyrillic-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "./style.css";
import "./planner.css";
import "./university.css";
import palette from "./palette.json";
import App from "./App.vue";

const themes = Object.fromEntries(
  Object.entries(palette).map(([name, p]) => [
    name,
    {
      dark: name === "Dark",
      colors: {
        ...p,
        background: p.surface,
        surface: p.card,
        primary: p.brand,
        "on-primary": p.onBrand,
      },
    },
  ]),
);
const defaultTheme =
  localStorage.getItem("campus-theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light");
const vuetify = createVuetify({
  components: { VApp, VBtn, VDialog, VIcon, VSnackbar },
  directives: { Ripple },
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  theme: { defaultTheme, themes },
});
createApp(App).use(vuetify).mount("#app");
