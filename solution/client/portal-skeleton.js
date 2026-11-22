const pageLayouts = {
  docs: "documents",
  "service-request": "form",
  booked: "requests",
  directory: "directory",
  person: "profile",
  chat: "chat",
  threads: "threads",
  navigator: "map",
  structure: "structure",
  plan: "plan",
  electives: "electives",
  dorm: "housing",
  residence: "residence",
  spaces: "booking",
  sports: "sports",
  finance: "payment",
  wifi: "wifi",
};

export const loadingNames = {
  login: "Загружаем вход",
  schedule: "Загружаем расписание",
  "office-schedule": "Загружаем расписание",
  lessons: "Загружаем занятия",
  grades: "Загружаем зачётку",
  plan: "Загружаем учебный раздел",
  electives: "Загружаем учебный раздел",
  services: "Загружаем сервисы",
  office: "Загружаем деканат",
  booking: "Загружаем бронирование",
  "booking-room": "Загружаем бронирование",
  sports: "Загружаем бронирование",
  map: "Загружаем план кампуса",
  directory: "Загружаем справочник",
  structure: "Загружаем справочник",
  profile: "Загружаем карточку участника",
  documents: "Загружаем каталог документов",
  requests: "Загружаем обращения",
  tasks: "Загружаем задачи деканата",
  form: "Загружаем форму",
  payment: "Загружаем начисления",
  housing: "Загружаем общежития",
  residence: "Загружаем общежития",
  wifi: "Загружаем данные Wi-Fi",
  chat: "Загружаем переписку",
  threads: "Загружаем справочник",
};

export function layoutForRoute(screen, role) {
  const page = screen?.pages?.at(-1);
  if (page?.view === "spaces" && page.peer) return "booking-room";
  if (page) return pageLayouts[page.view] || "requests";
  if (screen?.tab === 0 || (!screen && role === "office")) return "office";
  if (screen?.tab === 1 && role === "office") return "office-schedule";
  return {2: "grades", 3: "documents", 4: "services", 5: "plan"}[screen?.tab] || "schedule";
}

const backLinks = new Set(["booking", "booking-room", "directory", "documents", "form", "housing", "map",
  "payment", "profile", "requests", "residence", "sports", "wifi"]);
const studyTabs = new Set(["grades", "plan"]);
const passwordLogin = import.meta.env?.VITE_CAMPUS_AUTH === "password";

export function renderSkeleton(render, layout, full = false) {
  let key = 0;
  const block = (kind = "line", className = "") =>
    render("span", ["portal-placeholder", "is-" + kind, className].filter(Boolean).join(" "), [], key++);
  const group = (className, ...children) => render("div", className, children, key++);
  const repeat = (count, make) => Array.from({length: count}, (_, index) => make(index));
  const stack = (...children) => group("sk-stack", ...children);
  const spread = (...children) => group("sk-spread", ...children);
  const pills = (count, className = "") => group("sk-pills " + className, ...repeat(count, () => block("chip")));
  const fields = () => stack(block("label"), block("field"));
  const loginField = () => stack(block("label"),
    group("sk-login-field", block("caption"), ...(passwordLogin ? [] : [block("chevron")])));
  const copy = () => stack(block("line"), block("caption"));
  const iconRow = (className, icon = "icon", tail = "chevron") =>
    group("sk-icon-row " + className, block(icon), copy(), block(tail));
  const requests = () => group("sk-rows",
    ...repeat(3, () => group("sk-icon-row sk-card sk-request-row", block("icon"), copy(), block("badge"), block("chevron"))));
  const taskList = () => [
    pills(2, "sk-task-tabs"),
    group("sk-task-rows", ...repeat(2, () => iconRow("sk-task-row", "task-check", "badge"))),
  ];
  const lessons = () => [
    block("caption"),
    group("sk-rows", ...repeat(3, () => group("sk-card sk-office-lesson", block("label"), copy()))),
  ];
  const lesson = () => group("sk-day-lesson",
    stack(block("label"), block("tiny")),
    group("sk-day-details", block("label"), block("long"), block("caption"), block("caption")),
  );
  const spacePhotoCard = () => group("sk-card sk-space-card", block("photo"), group("sk-card-body", copy(), block("label")));
  const servicesTile = (name = "") => group("sk-card sk-service-tile " + name, block("subtitle"), block("decoration"));
  const documentSection = (count) => group("sk-doc-section",
    spread(block("line"), block("chevron")),
    group("sk-doc-grid", ...repeat(count, () => iconRow("sk-card sk-doc-item"))),
  );
  const planRow = () => group("sk-plan-row", block("line"), block("tiny"), block("label"));
  const housingActions = () => group("sk-rows", ...repeat(2, () => iconRow("sk-card sk-housing-action")));

  const layouts = {
    login: () => [
      group("sk-login-copy", group("sk-login-form",
        block("title"), group("sk-login-fields" + (passwordLogin ? " sk-password-fields" : ""),
          loginField(), loginField()), block("button"))),
      block("photo", "sk-login-image"),
    ],
    schedule: () => [
      group("sk-schedule",
        group("sk-schedule-day",
          group("sk-calendar-toolbar",
            stack(block("caption"), pills(7, "sk-day-picker")), block("round-button", "sk-calendar-export")),
          group("sk-day-agenda", spread(block("label"), block("rule")), lesson(), lesson(), lesson()),
        ),
        group("sk-schedule-week",
          group("sk-calendar-toolbar",
            group("sk-week-date", block("chevron"), block("subtitle"), block("chevron")),
            group("sk-week-mode", pills(2), block("round-button"))),
          group("sk-card sk-week-board",
            group("sk-week-head", block("tiny"), ...repeat(6, () => group("sk-week-day", block("tiny"), block("day")))),
            group("sk-week-body",
              group("sk-week-hours", ...repeat(9, () => block("tiny"))),
              ...repeat(6, () => group("sk-week-column",
                group("sk-week-event", block("tiny"), block("long"), block("line"), block("label")),
                group("sk-week-event", block("tiny"), block("long"), block("line"), block("label")),
              )),
            ),
          ),
        ),
      ),
    ],
    "office-schedule": () => [
      group("sk-office-controls", fields(), fields()), ...lessons(),
    ],
    lessons,
    grades: () => [
      group("sk-grades-grid",
        group("sk-card sk-grade-summary", stack(block("caption"), block("subtitle"), block("long")), block("study-ring")),
        group("sk-section-title", block("line"), block("label")),
        group("sk-card sk-grade-list", ...repeat(4, () =>
          group("sk-grade-row", copy(), group("sk-grade-status", block("task-check"), block("label")), block("chevron")))),
      ),
    ],
    plan: () => [
      group("sk-card sk-term-picker", ...repeat(8, () => block("chip"))),
      group("sk-card sk-plan-card", spread(block("subtitle"), block("badge")), ...repeat(6, planRow)),
    ],
    electives: () => [
      group("sk-card sk-panel", block("subtitle"), block("long"), block("line")),
      block("line"),
      ...repeat(3, () => iconRow("sk-card sk-elective", "task-check", "badge")),
    ],
    services: () => [
      group("sk-service-grid sk-service-campus",
        servicesTile("sk-service-wifi"), servicesTile("sk-service-sports"),
        servicesTile("sk-service-spaces"), servicesTile("sk-service-navigator")),
      group("sk-service-section", block("section-title"),
        group("sk-service-grid sk-service-requests", servicesTile(), servicesTile())),
      group("sk-service-section", block("section-title"),
        group("sk-service-grid sk-service-life", ...repeat(4, () => servicesTile()))),
    ],
    office: () => [
      group("sk-card sk-office-tasks", spread(block("subtitle"), block("button")), ...taskList()),
      block("button"), block("subtitle"), requests(),
    ],
    tasks: taskList,
    booking: () => [
      block("long", "sk-space-intro"),
      stack(block("subtitle"), block("long")),
      group("sk-space-buildings", spacePhotoCard(), spacePhotoCard()),
    ],
    "booking-room": () => [
      block("long", "sk-space-intro"), block("caption"),
      group("sk-space-reservation",
        spacePhotoCard(),
        group("sk-card sk-space-slots", block("subtitle"), group("sk-two-col", fields(), fields()),
          pills(6), block("line"), block("caption"), pills(3, "sk-periods"),
          group("sk-time-grid", ...repeat(12, () => block("field"))), block("button")),
      ),
    ],
    sports: () => [
      group("sk-card sk-sports-intro", stack(block("subtitle"), block("long")), block("decoration")),
      group("sk-search sk-sports-search", block("icon"), block("caption")),
      pills(6, "sk-sport-categories"),
      group("sk-sport-grid", ...repeat(6, () =>
        group("sk-card sk-sport-item", spread(block("sport-icon"), block("chevron")),
          block("tiny"), block("subtitle"), block("long"), block("line"), block("caption"), block("caption")),
      )),
    ],
    map: () => [
      group("sk-card sk-map-builder", group("sk-map-origin", fields()), block("round-button", "sk-map-swap"),
        group("sk-map-destination", fields()), block("button", "sk-map-submit")),
      group("sk-map-tools", group("sk-search", block("icon"), block("caption")), pills(5)),
      group("sk-map-layout",
        group("sk-card sk-map-board",
          group("sk-map-board-head", block("caption"), pills(4)),
          group("sk-map-canvas", block("map-shape"), block("zoom")),
          group("sk-map-floors", pills(4)),
        ),
        group("sk-card sk-map-sidebar", block("subtitle"), block("long"),
          ...repeat(5, () => iconRow("sk-map-result", "icon"))),
      ),
    ],
    directory: () => [
      group("sk-directory-tools", group("sk-search", block("icon"), block("caption")), fields(), fields()),
      group("sk-directory-count", block("caption")),
      group("sk-people-grid", ...repeat(6, () => iconRow("sk-card sk-person-row", "person-avatar"))),
    ],
    structure: () => [
      block("subtitle"),
      group("sk-structure-grid", ...repeat(6, () => group("sk-card sk-unit-row", copy(), block("chevron")))),
    ],
    profile: () => [
      group("sk-card sk-profile",
        block("profile-avatar"), block("subtitle"), block("long"), block("caption"),
        group("sk-rows", ...repeat(4, () => group("sk-unit-row", copy(), block("chevron")))),
      ),
    ],
    documents: () => [
      group("sk-doc-toolbar", group("sk-search", block("icon"), block("caption")), block("button")),
      documentSection(4), documentSection(2),
    ],
    requests: () => [block("caption"), requests()],
    form: () => [
      group("sk-card sk-form", group("sk-form-applicant", copy()),
        fields(), fields(), stack(block("label"), block("textarea")), block("button")),
    ],
    payment: () => [
      group("sk-payment-periods", block("field"), pills(8)),
      group("sk-card sk-payment-balance", spread(block("label"), block("caption")),
        stack(block("amount"), block("caption")), group("sk-two-col", block("button"), block("button"))),
      group("sk-payment-grid", ...repeat(2, () =>
        group("sk-card sk-panel", block("subtitle"), ...repeat(2, () => iconRow("sk-payment-row", "sport-icon", "badge"))))),
    ],
    housing: () => [
      group("sk-housing-grid",
        stack(block("line"), group("sk-card sk-home", spread(block("label"), block("icon")), block("subtitle"),
          block("long"), block("amount"), block("rule"), block("caption"))),
        stack(block("line"), group("sk-card sk-housing-balance", spread(block("label"), block("icon")),
          block("amount"), block("caption")), group("sk-card sk-unit-row", block("caption"), block("chevron")))),
      group("sk-housing-grid", stack(block("line"), housingActions()),
        stack(block("line"), group("sk-card sk-panel", block("icon"), copy()))),
      stack(block("line"), group("sk-housing-grid", ...repeat(2, () => iconRow("sk-card sk-housing-building")))),
    ],
    residence: () => [
      group("sk-card sk-panel", block("subtitle"), block("long"), block("caption")),
      group("sk-housing-grid", ...repeat(2, () => stack(block("line"),
        group("sk-card sk-panel", copy(), copy(), copy())))),
    ],
    wifi: () => [
      group("sk-wifi-grid",
        group("sk-card sk-wifi-access", group("sk-icon-row", block("sport-icon"), stack(block("label"), block("subtitle")), block("icon")),
          block("badge"), fields(), fields(), block("caption"), block("label")),
        group("sk-wifi-guide", block("subtitle"), ...repeat(3, () =>
          group("sk-icon-row sk-wifi-step", block("day"), copy())), spread(block("line"), block("chevron")), block("caption")),
      ),
    ],
    chat: () => [
      group("sk-card sk-chat",
        iconRow("sk-chat-person", "person-avatar"),
        group("sk-chat-log", block("message"), block("message"), block("message")),
        group("sk-chat-compose", block("field"), block("button"))),
    ],
    threads: () => [
      group("sk-threads", block("button"), block("subtitle"),
        group("sk-search", block("icon"), block("caption")),
        ...repeat(4, () => iconRow("sk-thread-row", "person-avatar", "label"))),
    ],
  };

  const regions = (layouts[layout] || layouts.requests)();
  if (!full || layout === "login") return group("portal-skeleton portal-skeleton--" + layout, ...regions);

  const rail = group("sk-rail", block("logo"), pills(layout === "office" || layout === "office-schedule" ? 4 : 3, "sk-rail-tabs"),
    group("sk-search sk-rail-search", block("icon"), block("caption")), block("round-button", "sk-settings"));
  const heading = group("sk-page-heading",
    ...(backLinks.has(layout) ? [block("back")] : []), block("title"));
  const nav = group("sk-phone-nav", ...repeat(4, () => stack(block("icon"), block("label"))));
  const workspace = group("sk-workspace",
    heading, ...(studyTabs.has(layout) ? [pills(2, "sk-study-tabs")] : []),
    group("sk-content", ...regions),
  );
  return group("portal-skeleton portal-skeleton--full portal-skeleton--" + layout, rail, workspace, nav);
}
