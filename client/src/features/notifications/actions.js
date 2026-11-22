import { today } from "../../shared/domain/timetable.js";
import { people } from "../../shared/domain/campus-data.js";
export async function enablePush({
  connectingPush,
  subscribePush,
  say
}) {
  if (connectingPush.value) return;
  connectingPush.value = true;
  try {
    await subscribePush();
  } catch (e) {
    say(e.message);
  } finally {
    connectingPush.value = false;
  }
}
export function showIncoming({
  notes,
  openNote,
  open
}, id) {
  const n = notes.value.find(n => n.id === id);
  if (n) openNote(n);else open("notices");
}
export async function openPendingNotice({
  owner,
  navigation,
  currentNavigation,
  showIncoming
}) {
  const match = /^#(?:notices|notice-(\d+))$/.exec(location.hash);
  const recipient = owner.value;
  if (!match || !recipient) return;
  const failure = await navigation.write(currentNavigation(), {
    replace: true
  });
  if (!failure && owner.value === recipient) showIncoming(Number(match[1]));
}
export function receivePush({
  owner,
  refresh,
  showIncoming,
  open
}, e) {
  const msg = e.data;
  if (msg?.type === "campus-owner") {
    e.ports[0]?.postMessage(Boolean(owner.value && owner.value === msg.owner));
  } else if (msg?.type === "campus-refresh" && owner.value === msg.owner) {
    void refresh().catch(() => {});
  } else if (msg?.type === "campus-open" && owner.value === msg.owner) {
    void refresh().catch(() => {}).then(() => {
      if (owner.value === msg.owner) showIncoming(msg.id);
    });
  } else if (msg === "open-campus-notices") {
    if (owner.value) open("notices");else location.hash = "notices";
  }
}
export function openNote({
  markRead,
  route,
  goPage,
  pages,
  records,
  openRecord,
  noteId,
  open
}, n) {
  if (!n.read) void markRead(n.id);
  if (n.ref === "electives") {
    route(5, today(), {
      navigate: false
    });
    goPage("electives");
    return;
  }
  if (n.ref?.startsWith("chat:") && people[n.ref.slice(5)]) {
    route(4, today(), {
      navigate: false
    });
    pages.value = [{
      view: "threads",
      peer: ""
    }];
    goPage("chat", n.ref.slice(5));
    return;
  }
  const result = n.ref && records.value.find(r => r.id === n.ref);
  if (result) {
    openRecord(result);
    return;
  }
  noteId.value = n.id;
  open("letter");
}
