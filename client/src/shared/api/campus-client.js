import { setServerClock } from "../domain/server-clock.js";
import demoAccess from "../domain/demo-access.json";
import { batch, computed, signal } from "@preact/signals-react";
import { noticeDelivery } from "../platform/notice-delivery.js";
import { newRequestId } from "./request-id.js";
const apiBase =
  (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "") + "/api/campus/";
function campusFetch(path, options) {
  if (import.meta.env.VITE_CAMPUS_AUTH === "password" &&
      (location.protocol !== "https:" || new URL(apiBase, location.href).protocol !== "https:")) {
    throw new Error("Для входа по паролю откройте деканат через HTTPS.");
  }
  return fetch(apiBase + path, {...options, redirect: "error"});
}

async function responseError(response) {
  const body = await response.json().catch(() => null);
  return Object.assign(Error(body?.error || "Сервер временно недоступен. Попробуйте ещё раз."), {status:response.status});
}

async function readAssistantStream(response, onEvent) {
  if (!response.body || !response.headers.get("Content-Type")?.includes("application/x-ndjson")) {
    throw new Error("Не удалось открыть поток ответа Тинки.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  function publish(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message || "Не удалось получить ответ Тинки.");
    if (event.type === "done") return event.chat;
    onEvent(event);
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) {
        const chat = publish(line);
        if (chat) return chat;
      }
      if (done) {
        const chat = publish(pending);
        if (chat) return chat;
        throw new Error("Ответ прервался. Попробуйте ещё раз.");
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function campusSession(notify, onLogout) {
  const token = signal(sessionStorage.getItem("atlas-session") || ""),
    role = signal(""),
    owner = signal(""),
    messages = signal([]),
    teachingGroups = signal([]),
    records = signal([]),
    notes = signal([]),
    reservations = signal([]),
    avatars = signal({}),
    busy = signal(false);
  const schedule = signal(null);
  const lessonChanges = signal([]);
  const scheduleRevision = signal(0);
  const delivery = noticeDelivery({campusFetch, api, token, owner, refresh});
  const electives = signal(null),
    grades = signal([]);
  const payments = signal({}),
    housing = signal(null),
    wifi = signal(null);
  let snapshotRevision = 0;
  let lastNote = null;
  let pendingRefreshes = 0;
  let pendingSubmission = null;
  async function api(command, data, auth = token.value, options = {}) {
    const response = await campusFetch(command, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + auth,
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: options.signal,
    });
    if (!response.ok) throw await responseError(response);
    return response.json();
  }
  async function assistantSendStream(chatId, data, onEvent, signal) {
    const response = await campusFetch("irishka/chats/" + encodeURIComponent(chatId) + "/messages/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
        Authorization: "Bearer " + token.value,
      },
      body: JSON.stringify(data),
      signal,
    });
    if (!response.ok) throw await responseError(response);
    return readAssistantStream(response, onEvent);
  }
  function commitSnapshot(state, lessons) {
    if (state.clock) setServerClock(state.clock);
    if (state.role) {
      if (sessionStorage.getItem("atlas-layout-role") !== state.role) sessionStorage.setItem("atlas-layout-role", state.role);
    } else {
      sessionStorage.removeItem("atlas-layout-role");
    }
    batch(() => {
      if (lessons) {
        const days = {};
        for (const lesson of lessons) (days[lesson.date] ||= []).push(lesson);
        schedule.value = days;
      }
      lessonChanges.value = state.lessonChanges || [];
      scheduleRevision.value = state.scheduleRevision || 0;
      grades.value = state.grades;
      owner.value = state.owner;
      role.value = state.role;
      messages.value = state.messages;
      teachingGroups.value = state.teachingGroups || [];
      electives.value = state.electives;
      payments.value = state.payments;
      housing.value = state.housing ?? null;
      wifi.value = state.wifi;
      notes.value = state.notes;
      records.value = state.records;
      reservations.value = state.reservations;
      avatars.value = state.avatars;
    });
  }
  async function refresh({background = false} = {}) {
    if (!token.value || (background && pendingRefreshes)) return;
    pendingRefreshes++;
    const revision = ++snapshotRevision;
    let state, lessons;
    try {
      state = await api("state");
      if (revision !== snapshotRevision) return;
      if (state.role !== "office" && (schedule.value === null || scheduleRevision.value !== state.scheduleRevision)) {
        lessons = await api("schedule?start=2026-09-01&end=2026-12-28");
      }
    } catch (error) {
      if (error.status === 401 && revision === snapshotRevision) {
        logout();
        notify(error.message);
      }
      throw error;
    } finally {
      pendingRefreshes--;
    }
    if (revision !== snapshotRevision) return;
    if (lastNote !== null && state.notes[0]?.id > lastNote) {
      notify(state.notes[0].title);
      for (const note of state.notes.filter(note => note.id > lastNote && !note.read).reverse())
        void delivery.display(note).catch(() => {});
    }
    commitSnapshot(state, lessons);
    lastNote = Math.max(lastNote || 0, state.notes[0]?.id || 0);
    delivery.sync(lastNote);
  }
  async function markRead(id) {
    const auth = token.value;
    try {
      await api("notes/" + id + "/read", {}, auth);
      if (auth === token.value) await refresh();
    } catch (e) {
      if (auth === token.value) notify(e.message);
    }
  }

  function logout() {
    pendingSubmission = null;
    const endpoint = sessionStorage.getItem("atlas-push-endpoint");
    const previousToken = token.value;
    if (endpoint && previousToken) {
      api("unsubscribe", { endpoint }, previousToken)
        .finally(() => api("logout", {}, previousToken))
        .catch(() => {});
      sessionStorage.removeItem("atlas-push-endpoint");
    }
    if (!endpoint && previousToken)
      api("logout", {}, previousToken).catch(() => {});
    ++snapshotRevision;
    lastNote = null;
    sessionStorage.removeItem("atlas-session");
    batch(() => {
      delivery.stop();
      busy.value = false;
      token.value = "";
      schedule.value = null;
      commitSnapshot({
        owner: "",
        role: "",
        electives: null,
        payments: {},
        housing: null,
        wifi: null,
        grades: [],
        messages: [],
        records: [],
        notes: [],
        avatars: {},
        reservations: [],
      });
    });
    if (previousToken) onLogout();
  }
  async function login(roleId, password) {
    logout();
    const data = await api("login", {
      role: roleId,
      password: password ?? (import.meta.env.VITE_CAMPUS_AUTH !== "password" ? demoAccess.password : undefined),
    });
    token.value = data.token;
    sessionStorage.setItem("atlas-session", data.token);
    await refresh();
  }
  async function perform(command, data, { throwOnError = false } = {}) {
    if (busy.value) return;
    busy.value = true;
    const auth = token.value;
    try {
      if (command === "request" && !data.requestId) {
        const fingerprint = JSON.stringify(data);
        if (pendingSubmission?.auth !== auth || pendingSubmission.fingerprint !== fingerprint) {
          pendingSubmission = { auth, fingerprint, id: newRequestId() };
        }
        data = { ...data, requestId: pendingSubmission.id };
      }
      const result = await api(command, data, auth);
      if (auth !== token.value) return;
      if (command === "notes/clear") {
        ++snapshotRevision;
        notes.value = notes.value.filter(note => note.id > data.through_id);
      } else if (command === "request" && result.record) {
        pendingSubmission = null;
        ++snapshotRevision;
        if (!records.value.some(record => record.id === result.record.id)) {
          records.value = [result.record, ...records.value];
        }
      } else {
        await refresh();
      }
      if (auth === token.value) return result;
    } catch (e) {
      if (auth === token.value) {
        if (throwOnError) throw e;
        notify(e.message);
      }
    } finally {
      if (auth === token.value) busy.value = false;
    }
  }
  async function download(record, attachment = false) {
    const auth = token.value;
    try {
      const r = await campusFetch((attachment ? "attachment/" : "file/") + record.id, {
        headers: { Authorization: "Bearer " + auth },
      });
      if (!r.ok) throw await responseError(r);
      const blob = await r.blob();
      if (auth !== token.value) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment ? record.attachment : record.name + ".pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      if (auth === token.value) notify(error.status ? error.message : "Не удалось скачать файл. Проверьте подключение.");
    }
  }
  return {
    assistantApi: (command, data, options) => api(command, data, token.value, options),
    assistantSendStream,
    stopDelivery: delivery.stop,
    enablePush: delivery.enable,
    pushMode: delivery.mode,
    markRead,
    schedule,
    lessonChanges,
    scheduleRevision,
    grades,
    electives,
    payments,
    housing,
    wifi,
    owner,
    messages,
    teachingGroups,
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
