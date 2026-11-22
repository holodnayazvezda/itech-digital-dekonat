import config from "./playwright.config.js";
export default {...config, projects:config.projects.filter(p => p.name.startsWith("chromium")).map(p => ({...p,use:{...p.use,channel:"chrome"}}))};
