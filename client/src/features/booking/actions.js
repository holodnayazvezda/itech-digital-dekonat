import { overlaps, today } from "../../shared/domain/timetable.js";
import { gym } from "../../shared/domain/campus-data.js";
export function findRoom({
  roomInitial,
  updatePage
}, short = "", date = today(), start) {
  roomInitial.value = {
    short,
    date,
    start
  };
  updatePage({
    view: short === gym?.short ? "sports" : "spaces",
    peer: short,
    date,
    start: start || ""
  });
}
export function changeBooking({
  page,
  pages,
  leavePage,
  navigation,
  currentNavigation
}, changes, transition) {
  const current = page.value;
  const {
    short = current.peer,
    ...fields
  } = changes;
  const next = {
    ...current,
    ...fields,
    peer: short
  };
  const previous = pages.value.at(-2);
  if (["back", "buildings"].includes(transition) && previous?.view === "spaces" && (previous.peer || "") === short && (previous.building || "") === (next.building || "")) {
    leavePage();
    return;
  }
  const push = transition === "push";
  pages.value = [...(push ? pages.value : pages.value.slice(0, -1)), next];
  void navigation.write(currentNavigation(), {
    replace: !push
  });
  if (push || transition === "buildings") window.scrollTo(0, 0);
}
export function overlapsBooking({
  homeAgenda
}, entry) {
  return homeAgenda.value.some(e => e.kind !== "gap" && e.id !== entry.id && overlaps(entry, e));
}
