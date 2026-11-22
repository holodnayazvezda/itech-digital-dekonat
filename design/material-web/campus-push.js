import * as webpush from "web-push";

export function campusPush(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS push_keys (id INTEGER PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS subscriptions (endpoint TEXT PRIMARY KEY, owner TEXT, value TEXT)",
  );
  const saved = db.prepare("SELECT value FROM push_keys WHERE id=1").get();
  const keys = saved ? JSON.parse(saved.value) : webpush.generateVAPIDKeys();
  if (!saved)
    db.prepare("INSERT INTO push_keys VALUES (1,?)").run(JSON.stringify(keys));
  const vapidDetails = { subject: "mailto:campus-demo@example.org", ...keys };
  function subscribe(owner, subscription) {
    let endpoint;
    try {
      endpoint = new URL(subscription?.endpoint);
    } catch {
      throw Object.assign(Error("Не удалось подключить уведомления"), {
        status: 400,
      });
    }
    const validHost =
      /^(?:fcm\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|(?:[a-z0-9-]+\.)*notify\.windows\.com)$/i.test(
        endpoint.hostname,
      );
    if (
      !validHost ||
      endpoint.protocol !== "https:" ||
      endpoint.port ||
      endpoint.username ||
      endpoint.password ||
      !/^[A-Za-z0-9_-]{87}=?$/.test(subscription.keys?.p256dh) ||
      !/^[A-Za-z0-9_-]{22}={0,2}$/.test(subscription.keys?.auth)
    )
      throw Object.assign(Error("Браузер вернул неподдерживаемую подписку"), {
        status: 400,
      });
    db.prepare("INSERT OR REPLACE INTO subscriptions VALUES(?,?,?)").run(
      endpoint.href,
      owner,
      JSON.stringify(subscription),
    );
  }
  function remove(owner, endpoint) {
    db.prepare("DELETE FROM subscriptions WHERE owner=? AND endpoint=?").run(
      owner,
      endpoint,
    );
  }
  async function deliver(owner, title) {
    const subscribers = db
      .prepare("SELECT endpoint,value FROM subscriptions WHERE owner=?")
      .all(owner);
    await Promise.all(
      subscribers.map(async (s) => {
        try {
          await webpush.sendNotification(
            JSON.parse(s.value),
            JSON.stringify({
              title,
              body: "Откройте цифровой деканат, чтобы прочитать уведомление.",
            }),
            { vapidDetails, TTL: 86400, timeout: 7500 },
          );
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410)
            remove(owner, s.endpoint);
        }
      }),
    );
  }
  return { publicKey: keys.publicKey, subscribe, remove, deliver };
}
