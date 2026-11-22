

const tabs = [
  { tab: 0, name: "office", path: "/office" },
  { tab: 1, name: "schedule", path: "/schedule" },
  { tab: 2, name: "study", path: "/study" },
  { tab: 4, name: "services", path: "/services" },
  { tab: 5, name: "study-plan", path: "/study/plan" },
];

const pages = [
  { view: "docs", path: "/services/documents/:peer?" },
  { view: "service-request", path: "/services/apply/:peer" },
  { view: "booked", path: "/services/requests" },
  { view: "directory", path: "/services/people/:peer?" },
  { view: "person", path: "/services/person/:peer" },
  { view: "chat", path: "/services/chat/:peer" },
  { view: "threads", path: "/services/chats/:peer?" },
  { view: "navigator", path: "/services/map/:peer?" },
  { view: "structure", path: "/services/structure/:peer?" },
  { view: "plan", path: "/services/program/:peer?" },
  { view: "electives", path: "/study/electives" },
  { view: "dorm", path: "/services/housing" },
  { view: "residence", path: "/services/housing/:peer" },
  { view: "spaces", path: "/services/booking/:peer?" },
  { view: "sports", path: "/services/sports/:peer?" },
  { view: "finance", path: "/services/payments" },
  { view: "wifi", path: "/services/wifi" },
];


export const campusRoutes = [
  { name: "entry", path: "/" },
  ...tabs.map(({ tab, ...route }) => ({ ...route, meta: { tab } })),
  ...pages.map(({ view, path }) => ({
    name: view,
    path,
    meta: { tab: view === "electives" ? 5 : 4, view },
    
  })),
  { name: "not-found", path: "/:rest(.*)*" },
];

function string(value) {
  return typeof value === "string" ? value : "";
}
export function routeDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function toCampusLocation({ tab, pages = [], date }, hash = "") {
  const page = pages.at(-1);
  const entry = page && campusRoutes.find(route => route.name === page.view);
  const name = entry?.name ?? tabs.find(item => item.tab === tab)?.name ?? "entry";
  const params = entry?.path.includes(":peer") ? { peer: page.peer || "" } : {};
  const query = {};
  if (page && ["navigator", "spaces", "sports"].includes(page.view)) {
    if (routeDate(page.date)) query.date = page.date;
    if (page.start) query.start = page.start;
    if (page.view === "spaces") {
      if (page.building) query.building = page.building;
      if (page.fund === "Аудиторный фонд") query.fund = "classrooms";
    }
    if (["spaces", "sports"].includes(page.view) && page.duration && page.duration !== 60) query.duration = String(page.duration);
    if (page.view === "navigator" && page.peer) {
      if (page.fromPlace) query.from = page.fromPlace;
      else if (page.fromEntrance) query.from = "entrance";
      else if (page.focusOnly) query.show = "place";
    }
  } else if (!page && tab === 1 && routeDate(date)) {
    query.date = date;
  }
  return { name, params, query, hash };
}

function inferredParents(view) {
  if (view === "service-request") return [{ view: "docs", peer: "" }];
  if (view === "person") return [{ view: "directory", peer: "" }];
  if (view === "residence") return [{ view: "dorm", peer: "" }];
  if (view === "chat") return [{ view: "threads", peer: "" }];
  return [];
}

export function fromCampusLocation(route, snapshot) {
  const { view, tab } = route.meta;
  if (tab === undefined) return null;
  const saved = snapshot?.path === route.fullPath ? snapshot.screen : null;
  if (saved) return saved;
  const date = routeDate(route.query.date);
  if (!view) return { tab, pages: [], date };
  const page = { view, peer: string(route.params.peer) };
  if (["navigator", "spaces", "sports"].includes(view) && date) page.date = date;
  if (view === "navigator" && page.peer) {
    const from = string(route.query.from);
    if (from === "entrance") page.fromEntrance = true;
    else if (/^[a-zA-Z0-9_-]{1,100}$/.test(from)) page.fromPlace = from;
    else if (route.query.show === "place") page.focusOnly = true;
  }
  if (["spaces", "sports"].includes(view) && /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(string(route.query.start))) page.start = route.query.start;
  if (view === "spaces") {
    const building = string(route.query.building);
    if (building && building.length <= 100) page.building = building;
    if (route.query.fund === "classrooms") page.fund = "Аудиторный фонд";
  }
  if (["spaces", "sports"].includes(view)) {
    const duration = Number(string(route.query.duration));
    if (duration >= 30 && duration <= 240 && duration % 30 === 0) page.duration = duration;
  }
  return { tab, pages: [...inferredParents(view), page], date: "" };
}


export function resolveCampusLocation(target, base='/', origin='http://localhost') {
 const pathname=typeof target==='string'?new URL(target,origin).pathname:null;
 let fullPath,route,params={};
 if(pathname!==null){const url=new URL(target,origin);const relative=url.pathname.slice(base.replace(/\/$/,'').length)||'/';fullPath=relative+url.search+url.hash;for(const candidate of campusRoutes){if(candidate.name==='not-found')continue;const expression=candidate.path.replace(/\/:peer\?/,'(?:/([^/]+))?').replace(/:peer/,'([^/]+)');const match=relative.match(new RegExp('^'+expression+'/?$'));if(match){route=candidate;if(match[1]){try{params.peer=decodeURIComponent(match[1])}catch{params.peer=match[1]}}break;}}return {meta:route?.meta||{},params,query:Object.fromEntries(url.searchParams),fullPath,href:base.replace(/\/$/,'')+fullPath};}
 route=campusRoutes.find(r=>r.name===target.name)||campusRoutes[0];params=target.params||{};let path=route.path.replace(/\/:peer\?/g,params.peer?'/'+encodeURIComponent(params.peer):'').replace(/:peer/g,encodeURIComponent(params.peer||''));const query=new URLSearchParams(target.query||{}).toString();fullPath=path+(query?'?'+query:'')+(target.hash||'');return {meta:route.meta||{},params,query:target.query||{},fullPath,href:base.replace(/\/$/,'')+fullPath};
}
export function createCampusNavigation(){const base=import.meta.env.BASE_URL;const listeners=new Set();const resolve=target=>resolveCampusLocation(target,base,location.origin);const read=()=>fromCampusLocation(resolve(location.href),history.state?.campusScreen);const emit=()=>{for(const listener of listeners)listener(read())};window.addEventListener('popstate',emit);return {read,href:target=>resolve(target).href,write(screen,{replace=false,hash=''}={}){const target=resolve(toCampusLocation(screen,hash));const current=resolve(location.href);const duplicate=current.fullPath===target.fullPath;const state={...history.state,campusScreen:{path:target.fullPath,screen},back:replace||duplicate?history.state?.back:current.fullPath};history[replace||duplicate?'replaceState':'pushState'](state,'',target.href);if(!duplicate)emit();return Promise.resolve();},subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},back(screen){if(history.state?.back===resolve(toCampusLocation(screen)).fullPath)history.back();else return this.write(screen,{replace:true});},dispose(){window.removeEventListener('popstate',emit);listeners.clear()}}}
