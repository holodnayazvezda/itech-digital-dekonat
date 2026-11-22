import { signal } from "@preact/signals-react";

export function browserNoticeHint() {
  if (!window.isSecureContext) return "Для системных уведомлений откройте кабинет по HTTPS.";
  const appleMobile = "standalone" in navigator || /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (appleMobile && !navigator.standalone && !window.matchMedia("(display-mode: standalone)").matches) {
    return "Для системных уведомлений добавьте кабинет на экран «Домой» через меню «Поделиться», затем откройте его с иконки.";
  }
  if (!navigator.serviceWorker || typeof window.Notification?.requestPermission !== "function") {
    return "В этом браузере уведомления доступны в кабинете.";
  }
  return "";
}

// A device can have one PushSubscription and several independently signed-in cabinets.
export function noticeDelivery({ campusFetch, api, token, owner, refresh }) {
  const mode = signal("off");
  let session, worker, enrolling;
  const matches = current => current && session === current && token.value === current.auth;
  const supported = () => !browserNoticeHint();
  function registration() {
    if (!worker) {
      worker = navigator.serviceWorker.register(import.meta.env.BASE_URL + "campus-worker.js")
        .then(() => navigator.serviceWorker.ready)
        .catch(error => { worker = undefined; throw error; });
    }
    return worker;
  }
  async function display(note, current = session) {
    if (!matches(current) || note.owner !== current.owner || !supported() || Notification.permission !== "granted") return;
    const reg = await registration();
    if (matches(current)) reg.active?.postMessage({type: "campus-note", id: note.id, owner: note.owner, title: note.title});
  }
  async function enroll(current) {
    const reg = await registration();
    if (!matches(current)) return;
    mode.value = "foreground";
    if (!reg.pushManager) return;
    const {key} = await api("push-key", undefined, current.auth);
    const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    let sub = await reg.pushManager.getSubscription();
    const previous = sub?.options?.applicationServerKey;
    const previousBytes = previous && new Uint8Array(previous);
    if (previousBytes && (bytes.length !== previousBytes.length || !bytes.every((byte, i) => byte === previousBytes[i]))) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: bytes});
      } catch (error) {
        // Another tab might finish subscribing between getSubscription and subscribe.
        sub = await reg.pushManager.getSubscription();
        if (!sub) throw error;
      }
    }
    if (!matches(current)) return;
    sessionStorage.setItem("atlas-push-endpoint", sub.endpoint);
    await api("subscribe", {subscription: sub.toJSON()}, current.auth);
    if (matches(current)) mode.value = "background";
  }
  function connect(current) {
    if (!matches(current)) return;
    if (!enrolling) {
      current.retryAt = Date.now() + 300_000;
      const task = enroll(current).finally(() => {
        if (enrolling === task) enrolling = undefined;
      });
      enrolling = task;
    }
    return enrolling;
  }
  async function stream(current) {
    while (matches(current) && !current.abort.signal.aborted) {
      try {
        const res = await campusFetch("notes/events?after=" + current.cursor, {
          signal: current.abort.signal, headers: { Authorization: "Bearer " + current.auth, Accept: "text/event-stream" },
        });
        if (!res.ok || !res.body || !res.headers.get("Content-Type")?.includes("text/event-stream")) throw Error();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (matches(current)) {
          const {value, done} = await reader.read();
          if (done || !matches(current)) break;
          buffer += decoder.decode(value, {stream: true});
          let end;
          while ((end = buffer.indexOf("\n\n")) !== -1) {
            const line = buffer.slice(0, end).split("\n").find(item => item.startsWith("data: "));
            buffer = buffer.slice(end + 2);
            if (!line) continue;
            const note = JSON.parse(line.slice(6));
            if (note.owner !== current.owner || note.id <= current.cursor) continue;
            current.cursor = note.id;
            void display(note, current).catch(() => {});
            void refresh().catch(() => {});
          }
        }
      } catch {
        // Regular cabinet snapshots can also deliver while the event stream reconnects.
      }
      if (matches(current)) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  async function enable() {
    if (!supported()) throw Error("Системные уведомления доступны по HTTPS или на localhost в поддерживаемом браузере.");
    const current = session;
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (!matches(current)) return;
    if (permission !== "granted") throw Error("Разрешите уведомления в настройках этого сайта в браузере.");
    try { await connect(current); }
    catch {
      throw Error(mode.value === "foreground" ? "Служба фоновой доставки недоступна. Пока кабинет открыт, уведомления продолжат приходить." : "Браузер не подключил службу уведомлений. Проверьте разрешение для этого сайта.");
    }
  }
  function stop() {
    session?.abort.abort();
    session = enrolling = undefined;
    mode.value = "off";
  }
  function sync(cursor) {
    if (matches(session)) {
      // Permission can change in the browser's site settings while this page is open.
      if (supported() && Notification.permission !== session.permission) {
        session.permission = Notification.permission;
        if (session.permission === "granted") void connect(session)?.catch(() => {});
        else mode.value = "off";
      } else if (session.permission === "granted" && mode.value !== "background" && !enrolling && Date.now() >= session.retryAt) {
        void connect(session)?.catch(() => {});
      }
      return;
    }
    stop();
    session = {auth: token.value, owner: owner.value, cursor, abort: new AbortController(), permission: window.Notification?.permission};
    void stream(session);
    if (supported() && session.permission === "granted") void connect(session)?.catch(() => {});
  }
  return { mode, sync, stop, enable, display };
}
