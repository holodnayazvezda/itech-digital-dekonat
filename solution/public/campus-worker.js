self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const windows = () => self.clients.matchAll({type: "window", includeUncontrolled: true});
let showing = Promise.resolve();

// Web Push and several open tabs can report the same committed notice.
function display(note) {
  const task = showing.then(async () => {
    if (!note.title) return;
    const tag = note.id && note.owner ? "campus:" + note.owner + ":" + note.id : undefined;
    const cache = await caches.open("campus-notification-receipts-v1").catch(() => null);
    const key = new URL("notification-receipts", self.registration.scope).href;
    const entry = await cache?.match(key).catch(() => null);
    const seen = entry ? await entry.json().catch(() => []) : [];
    if (tag && (seen.includes(tag) || (!cache && (await self.registration.getNotifications({tag})).length))) return;
    await self.registration.showNotification(note.title, {
      body: note.body || "Откройте цифровой деканат, чтобы прочитать уведомление.",
      icon: "./mark.svg", tag, data: {id: note.id, owner: note.owner},
    });
    if (tag) await cache?.put(key, new Response(JSON.stringify([...seen.slice(-511), tag]))).catch(() => {});
  });
  showing = task.catch(() => {});
  return task;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "campus-note") event.waitUntil(display(event.data));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const note = event.data.json();
  event.waitUntil(Promise.all([
    display(note),
    windows().then(clients => clients.forEach(c => c.postMessage({type: "campus-refresh", owner: note.owner}))),
  ]));
});

function ownsCabinet(client, owner) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    function finish(matches) {
      clearTimeout(timer);
      channel.port1.close();
      resolve(matches);
    }
    const timer = setTimeout(() => finish(false), 500);
    channel.port1.onmessage = e => finish(e.data === true);
    client.postMessage({type: "campus-owner", owner}, [channel.port2]);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const {id, owner} = event.notification.data || {};
  event.waitUntil((async () => {
    const clients = await windows();
    const matches = await Promise.all(clients.map(c => ownsCabinet(c, owner)));
    const client = clients[matches.indexOf(true)];
    if (client) {
      await client.focus();
      client.postMessage({type: "campus-open", id, owner});
    } else {
      const hash = id ? "#notice-" + id : "#notices";
      await self.clients.openWindow(new URL("./" + hash, self.registration.scope).href);
    }
  })());
});
