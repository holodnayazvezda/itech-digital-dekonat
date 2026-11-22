import { createApp, markRaw } from "vue";
import CampusShell from "./CampusShell.js";
import { createCampusNavigation } from "./campus-routes.js";
import "@fontsource-variable/geologica/wght.css";
import "@fontsource-variable/golos-text/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "./base.css";
import "./style.css";
import "./planner.css";
import "./university.css";
import "./campus.css";
import "./portal-loading.css";
import "./minimal.css";
import "./services.css";
import "./irishka.css";

import "./profile.css";
import "./header.css";
import "./appearance.css";
import "./selectors.css";
import "./wifi.css";
import "./documents-catalog.css";
import "./requests.css";
import "./navigator-design.css";
import "./notifications.css";

const navigation = markRaw(createCampusNavigation());
createApp(CampusShell, { navigation }).use(navigation.router).mount("#app");
