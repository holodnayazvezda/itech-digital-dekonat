import { today } from "../../shared/domain/timetable.js";
import { services } from "../../shared/domain/services.js";
import { routeDate, toCampusLocation } from "../../shared/routing/campus-routes.js";
import { people } from "../../shared/domain/campus-data.js";
import { afterPaint } from "../../shared/ui/ui.jsx";
export function assistantLocation({
  role,
  visibleTab,
  pageNames
}, action, detail) {
  if (action === "schedule") {
    return {
      tab: 1,
      date: routeDate(detail?.date) || today(),
      pages: []
    };
  }
  if (action === "navigator") {
    const fromPlace = detail?.from?.id;
    const peer = detail?.to?.id || "";
    return {
      tab: 4,
      pages: [{
        view: "navigator",
        peer,
        fromPlace,
        focusOnly: Boolean(peer && !fromPlace)
      }]
    };
  }
  if (["sports", "spaces", "docs", "booked", "directory"].includes(action)) {
    if (action === "docs" && role.value !== "student" || ["sports", "spaces"].includes(action) && !["student", "teacher"].includes(role.value)) return null;
    return {
      tab: 4,
      pages: [{
        view: action,
        peer: ""
      }]
    };
  }
  const targetTab = {
    study: 2,
    services: 4,
    queue: 0,
    "office-tasks": 0
  }[action];
  if (targetTab !== undefined && visibleTab(targetTab) && (targetTab !== 0 || role.value === "office")) {
    return {
      tab: targetTab,
      pages: []
    };
  }
  const category = action === "search-result" ? detail?.category : "";
  const form = action === "document-form" ? detail?.name : detail?.serviceView === "service-request" ? detail.id : "";
  if (form && role.value === "student" && services.some(item => item.name === form)) {
    return {
      tab: 4,
      pages: [{
        view: "docs",
        peer: ""
      }, {
        view: "service-request",
        peer: form
      }]
    };
  }
  if (category === "people" && Object.hasOwn(people, detail.id)) {
    return {
      tab: 4,
      pages: [{
        view: "directory",
        peer: ""
      }, {
        view: "person",
        peer: detail.id
      }]
    };
  }
  if (category === "rooms" && detail.id) {
    return {
      tab: 4,
      pages: [{
        view: "navigator",
        peer: detail.id,
        focusOnly: true
      }]
    };
  }
  if (category === "subjects") {
    return {
      tab: 1,
      date: routeDate(detail.date) || today(),
      pages: []
    };
  }
  if (category === "services" && Object.hasOwn(pageNames, detail.serviceView) && detail.serviceView !== "service-request") {
    const view = detail.serviceView;
    return {
      tab: view === "electives" ? 5 : 4,
      pages: [{
        view,
        peer: ""
      }]
    };
  }
  return null;
}
export function assistantHref({
  assistantLocation,
  navigation
}, action, detail) {
  const destination = assistantLocation(action, detail);
  return destination ? navigation.href(toCampusLocation(destination)) : undefined;
}
export function openAssistantAction({
  assistantLocation,
  route,
  pages,
  roomInitial,
  updatePage,
  schedule,
  showEvent,
  download,
  open
}, action, detail) {
  const destination = assistantLocation(action, detail);
  if (destination) {
    route(destination.tab, destination.date || today(), {
      navigate: !destination.pages.length
    });
    const target = destination.pages.at(-1);
    if (target) {
      pages.value = destination.pages.slice(0, -1);
      roomInitial.value = null;
      updatePage(target);
    } else if (action === "search-result" && detail.lessonId) {
      const lesson = schedule.value?.[destination.date]?.find(item => item.id === detail.lessonId);
      if (lesson) showEvent(lesson);
    } else if (action === "office-tasks") {
      afterPaint(() => document.getElementById("office-todo-title")?.focus());
    }
  } else if (action === "document-download" && detail?.id) {
    void download(detail);
  } else if (action === "notices") {
    open("notices");
  }
}
export async function bookAssistantSport({
  perform
}, {
  sport,
  short,
  date,
  time,
  end
}) {
  const result = await perform("request", {
    kind: "booking",
    sport,
    short,
    date,
    time,
    end
  }, {
    throwOnError: true
  });
  if (!result?.record) throw new Error("Заявка не отправилась. Попробуйте ещё раз.");
  return result.record;
}
