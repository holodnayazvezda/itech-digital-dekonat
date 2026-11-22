self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: "./mark.svg" }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL("./", self.registration.scope).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const target = windows.find((client) => client.url.startsWith(url));
      if (target) {
        await target.focus();
        target.postMessage("open-campus-notices");
      } else await self.clients.openWindow(url + "#notices");
    })(),
  );
});
