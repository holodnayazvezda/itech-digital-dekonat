import { ref, computed } from "vue";
export function campusSession(notify) {
  const token = ref(sessionStorage.getItem("atlas-session") || ""),
    role = ref(""),
    owner = ref(""),
    messages = ref([]),
    records = ref([]),
    notes = ref([]),
    reservations = ref([]),
    avatars = ref({}),
    busy = ref(false);
  const electives = ref(null);
  const payments = ref({}),
    wifi = ref(null);
  let version = 0,
    lastNote = null;
  async function api(command, data, auth = token.value) {
    const r = await fetch("/api/campus/" + command, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + auth,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.error);
    return body;
  }
  async function refresh() {
    if (!token.value) return;
    const id = ++version;
    const state = await api("state");
    if (version !== id) return;
    if (lastNote !== null && state.notes[0]?.id > lastNote) {
      notify(state.notes[0].title);
    }
    role.value = state.role;
    owner.value = state.owner;
    messages.value = state.messages;
    electives.value = state.electives;
    payments.value = state.payments;
    wifi.value = state.wifi;
    notes.value = state.notes;
    lastNote = state.notes[0]?.id || 0;
    records.value = state.records;
    reservations.value = state.reservations;
    avatars.value = state.avatars;
  }
  async function enablePush() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      throw Error("В этом браузере доступны уведомления внутри кабинета");
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error("Уведомления доступны в кабинете");
    await navigator.serviceWorker.register(
      import.meta.env.BASE_URL + "campus-worker.js",
    );
    const registration = await navigator.serviceWorker.ready;
    const { key } = await api("push-key");
    const bytes = Uint8Array.from(
      atob(key.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }));
    await api("subscribe", { subscription: subscription.toJSON() });
    sessionStorage.setItem("atlas-push-endpoint", subscription.endpoint);
  }
  function logout() {
    const endpoint = sessionStorage.getItem("atlas-push-endpoint");
    if (endpoint && token.value) {
      api("unsubscribe", { endpoint }).catch(() => {});
      sessionStorage.removeItem("atlas-push-endpoint");
    }
    ++version;
    lastNote = null;
    electives.value = null;
    payments.value = {};
    wifi.value = null;
    role.value = "";
    owner.value = "";
    messages.value = [];
    token.value = "";
    sessionStorage.removeItem("atlas-session");
    records.value = [];
    notes.value = [];
    avatars.value = {};
    reservations.value = [];
  }
  async function login(r) {
    logout();
    const data = await api("login", { role: r });
    token.value = data.token;
    sessionStorage.setItem("atlas-session", data.token);
    await refresh();
  }
  async function perform(command, data) {
    if (busy.value) return;
    busy.value = true;
    try {
      const r = await api(command, data);
      await refresh();
      return r;
    } catch (e) {
      notify(e.message);
    } finally {
      busy.value = false;
    }
  }
  async function download(record, attachment = false) {
    const r = await fetch(
      "/api/campus/" + (attachment ? "attachment/" : "file/") + record.id,
      {
        headers: { Authorization: "Bearer " + token.value },
      },
    );
    if (!r.ok) {
      notify((await r.json()).error);
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment ? record.attachment : record.name + ".pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return {
    enablePush,
    electives,
    payments,
    wifi,
    owner,
    messages,
    role,
    token,
    records,
    notes,
    reservations,
    avatars,
    busy,
    login,
    logout,
    refresh,
    perform,
    download,
    bookings: computed(() =>
      records.value.filter(
        (r) => r.kind === "booking" && r.status === "approved",
      ),
    ),
  };
}
