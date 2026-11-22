import { electiveStore } from "./elective-store.js";
import { electiveOptions } from "./electives.js";
import { campusPush } from "./campus-push.js";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import {
  people,
  rooms,
  gym,
  gymSeatsLeft,
  catalogue,
  roomActivities,
  numberTime,
} from "./campus-data.js";
import { services, submittedFields } from "./services.js";
import { transferRequirements } from "./university.js";
import { financePeriods, payment } from "./campus-payments.js";
import { overlaps, today } from "./timetable.js";
const font = createRequire(import.meta.url).resolve(
  "dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
);
const ttl = 86400000;
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function campusApi() {
  // This archived design preview uses disposable data. The live API owns the encrypted store.
  const db = new DatabaseSync(":memory:");
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,body TEXT); CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,owner TEXT,title TEXT,body TEXT,priority INTEGER,ref TEXT,created INTEGER); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,owner TEXT); CREATE TABLE IF NOT EXISTS avatars(owner TEXT PRIMARY KEY,data TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender); CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS attachments(record_id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,content BLOB NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS demo_wifi(owner TEXT PRIMARY KEY, password TEXT NOT NULL, ready INTEGER NOT NULL)",
  );
  const electives = electiveStore(db);
  const wifiFor = (owner) => {
    if (!["student", "teacher"].includes(people[owner].role)) return null;
    const existing = db
      .prepare("SELECT password, ready FROM demo_wifi WHERE owner=?")
      .get(owner);
    if (existing) return existing;
    const password = "campus-" + randomUUID().slice(0, 8);
    db.prepare("INSERT INTO demo_wifi VALUES(?,?,0)").run(owner, password);
    return { password, ready: 0 };
  };
  const push = campusPush(db);
  const sql = (s, ...args) => db.prepare(s).all(...args);
  const list = () =>
    sql("SELECT body FROM records ORDER BY rowid DESC").map((r) =>
      JSON.parse(r.body),
    );
  const put = (r) =>
    db
      .prepare("INSERT OR REPLACE INTO records VALUES(?,?,?,?)")
      .run(r.id, r.owner, r.kind, JSON.stringify(r));
  const note = (owner, title, body, priority = 2, ref = "") =>
    db
      .prepare(
        "INSERT INTO notes(owner,title,body,priority,ref,created) VALUES(?,?,?,?,?,?)",
      )
      .run(owner, title, body, priority, ref, Date.now());
  if (!sql("SELECT id FROM notes LIMIT 1").length) {
    for (const [id, name, format] of [
      ["paper", "Справка об обучении", "Бумажная"],
      ["electronic", "Выписка из зачётной книжки", "Электронная"],
    ]) {
      put({
        id,
        owner: "student",
        kind: "document",
        name,
        format,
        status: "approved",
        created: Date.now(),
        ...(format === "Электронная" ? { expires: Date.now() + ttl } : {}),
      });
      note(
        "student",
        name + " готова",
        format === "Бумажная"
          ? "Заберите документ в Б-214 с 10:00 до 16:00."
          : "Электронный экземпляр доступен в разделе документов.",
        3,
        id,
      );
    }
    note(
      "student",
      "Экзамен 24 ноября",
      "История культуры, 10:00. Аудитория Б-240. Возьмите студенческий билет.",
      2,
    );
    note(
      "student",
      "О зимней аттестации",
      "Деканат приглашает студентов на консультации перед зимней аттестацией.\n\nПроверьте даты дисциплин в расписании и текущие результаты в зачётной книжке. Если результат контрольной точки ещё не опубликован, обратитесь к преподавателю.\n\nС вопросами по индивидуальному графику можно обратиться в студенческий офис.",
      1,
    );
    note(
      "teacher",
      "Расписание консультаций",
      "Проверьте расписание групп АД-21 и АД-32 перед началом консультаций.",
      2,
    );
  }
  for (const person of Object.values(people).filter(
    (p) => p.role === "teacher" && p.id !== "teacher",
  )) {
    if (
      !db.prepare("SELECT id FROM notes WHERE owner=? LIMIT 1").get(person.id)
    )
      note(
        person.id,
        "Обращения студентов",
        "Проверяйте личные сообщения. Ответить студенту можно в разделе «Персоналии».",
        2,
      );
  }
  const checkRoom = (r, except) => {
    if (r.short === gym.short) {
      const relevant = list().filter(
        (o) =>
          o.kind === "booking" &&
          o.short === gym.short &&
          o.date === r.date &&
          o.id !== except,
      );
      if (
        relevant.some(
          (o) =>
            o.owner === r.owner &&
            ["approved", "pending"].includes(o.status) &&
            overlaps(r, o),
        )
      )
        fail("У вас уже есть заявка на место в это время", 409);
      if (
        gymSeatsLeft(
          r.date,
          numberTime(r.time),
          numberTime(r.end),
          relevant.filter((o) => o.status === "approved"),
        ) < 1
      )
        fail("На выбранное время мест не осталось", 409);
      return;
    }
    const busy = [
      ...roomActivities(r.date).filter((e) => e.room === r.short),
      ...list().filter(
        (e) =>
          e.kind === "booking" &&
          e.short === r.short &&
          e.status === "approved" &&
          e.id !== except,
      ),
    ];
    if (busy.some((e) => overlaps(e, r)))
      fail("Помещение уже занято в это время", 409);
  };
  async function handle(req, res, next) {
    const path = (req.url || "").split("?")[0];
    if (!path.startsWith("/api/campus/")) return next();
    const action = path.slice(12);
    res.setHeader("Cache-Control", "no-store");
    try {
      let data = {};
      if (req.method === "POST") {
        let buf = "";
        for await (const chunk of req) {
          buf += chunk;
          if (buf.length > 2900000) fail("Файл слишком велик", 413);
        }
        data = JSON.parse(buf || "{}");
      }
      const reply = (v) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(v));
      };
      if (action === "login" && req.method === "POST") {
        if (!Object.hasOwn(people, data.role)) fail("Выберите кабинет");
        const token = randomUUID();
        db.prepare("INSERT INTO sessions VALUES(?,?)").run(token, data.role);
        return reply({ token });
      }
      const owner = sql(
        "SELECT owner FROM sessions WHERE token=?",
        String(req.headers.authorization || "").replace(/^Bearer /, ""),
      )[0]?.owner;
      if (!owner) fail("Откройте демонстрационный кабинет", 401);
      if (action === "push-key" && req.method === "GET")
        return reply({ key: push.publicKey });
      if (action === "subscribe" && req.method === "POST") {
        push.subscribe(owner, data.subscription);
        return reply({ ok: true });
      }
      if (action === "unsubscribe" && req.method === "POST") {
        push.remove(owner, String(data.endpoint || ""));
        return reply({ ok: true });
      }
      if (action === "state" && req.method === "GET") {
        return reply({
          owner,
          role: people[owner].role,
          messages: sql(
            "SELECT * FROM messages WHERE sender=? OR recipient=? ORDER BY id",
            owner,
            owner,
          ),
          electives:
            people[owner].role === "student" ? electives.state(owner) : null,
          wifi: wifiFor(owner),
          payments: !["student", "teacher"].includes(people[owner].role)
            ? {}
            : Object.fromEntries(
                financePeriods.map((month) => [
                  month,
                  payment(people[owner].role, month, owner),
                ]),
              ),
          records: list().filter(
            (r) => owner === "office" || r.owner === owner,
          ),
          reservations: list()
            .filter((r) => r.kind === "booking" && r.status === "approved")
            .map(({ short, date, time, end, owner }) => ({
              short,
              date,
              time,
              end,
              by: short === gym.short ? "Занятое место" : people[owner].name,
            })),
          notes: sql(
            "SELECT * FROM notes WHERE owner=? ORDER BY id DESC",
            owner,
          ),
          avatars: Object.fromEntries(
            sql("SELECT * FROM avatars").map((a) => [a.owner, a.data]),
          ),
        });
      }
      if (action.startsWith("attachment/") && req.method === "GET") {
        const id = action.slice(11);
        const record = db
          .prepare("SELECT owner FROM records WHERE id=?")
          .get(id);
        if (!record || (owner !== "office" && record.owner !== owner))
          fail("Вложение не найдено", 404);
        const file = db
          .prepare("SELECT * FROM attachments WHERE record_id=?")
          .get(id);
        if (!file) fail("Вложение не найдено", 404);
        res.setHeader("Content-Type", file.mime);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
        );
        return res.end(Buffer.from(file.content));
      }
      if (action.startsWith("file/") && req.method === "GET") {
        const r = list().find(
          (r) =>
            r.id === action.slice(5) &&
            r.owner === owner &&
            r.kind === "document" &&
            r.format === "Электронная" &&
            r.status === "approved",
        );
        if (!r) fail("Документ не найден", 404);
        if (Date.now() >= r.expires) fail("Срок ссылки истёк", 410);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="campus-document.pdf"',
        );
        const pdf = new PDFDocument({ size: "A4", margin: 60 });
        pdf.pipe(res);
        pdf
          .font(font)
          .fillColor("#174638")
          .fontSize(12)
          .text("ЦИФРОВОЙ ДЕКАНАТ    /    УЧЕБНЫЙ ОБРАЗЕЦ")
          .moveDown(2)
          .fontSize(24)
          .text(r.name)
          .moveDown()
          .fontSize(13)
          .text("Получатель: " + people[owner].name)
          .moveDown()
          .text("Электронный экземпляр · № " + r.id.slice(0, 8))
          .moveDown()
          .text(
            r.name.includes("зачёт")
              ? owner === "friend"
                ? "Анализ данных — хорошо, 78 баллов. Иностранный язык — зачтено."
                : "Анализ данных — отлично, 92 балла. Проектный семинар — зачтено. Иностранный язык — зачтено."
              : "Документ подготовлен по обращению обучающегося программы «" +
                  people[owner].program +
                  "», группа " +
                  people[owner].unit +
                  ".",
          )
          .moveDown();
        for (const [key, value] of Object.entries(r.details || {}))
          pdf.text(key + " · " + value);
        pdf.moveDown(2).text("Демонстрационный документ. Сведения вымышлены.");
        pdf.end();
        return;
      }
      if (req.method !== "POST") fail("Метод не поддерживается", 405);
      // All decision checks and writes are synchronous in a single SQLite transaction.
      db.exec("BEGIN IMMEDIATE");
      let result = {},
        delivery;
      try {
        if (action === "choose-elective") {
          if (people[owner].role !== "student")
            fail("Выбор доступен студентам", 403);
          if (electives.choose(owner, data.course, data.previous)) {
            note(
              owner,
              "Дисциплина добавлена в учебный план",
              electiveOptions.find((o) => o.id === data.course).name +
                " · 4 семестр · 5 з. е.",
              2,
              "electives",
            );
          }
        } else if (action === "reset-wifi") {
          if (!wifiFor(owner)) fail("Сервис недоступен", 403);
          db.prepare(
            "UPDATE demo_wifi SET password=?, ready=? WHERE owner=?",
          ).run(
            "campus-" + randomUUID().slice(0, 8),
            Date.now() + 300000,
            owner,
          );
        } else if (action === "message") {
          if (!Object.hasOwn(people, data.to) || data.to === owner)
            fail("Выберите собеседника");
          const body = String(data.body || "").trim();
          if (!body || body.length > 4000)
            fail("Введите сообщение до 4000 символов");
          db.prepare(
            "INSERT INTO messages(sender,recipient,body,created) VALUES(?,?,?,?)",
          ).run(owner, data.to, body, Date.now());
          note(
            data.to,
            "Сообщение · " + people[owner].name,
            body,
            2,
            "chat:" + owner,
          );
          delivery = [data.to, "Новое личное сообщение"];
        } else if (action === "avatar") {
          if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.image))
            fail("Неверный формат фото");
          db.prepare("INSERT OR REPLACE INTO avatars VALUES(?,?)").run(
            owner,
            data.image,
          );
        } else if (action === "request") {
          if (!["student", "teacher"].includes(people[owner].role))
            fail("Выберите личный кабинет", 403);
          const r = {
            id: randomUUID(),
            owner,
            kind: data.kind,
            status: "pending",
            created: Date.now(),
          };
          if (r.kind === "booking") {
            const room = rooms.find((x) => x.short === data.short);
            if (
              !room ||
              !/^2026-\d{2}-\d{2}$/.test(data.date) ||
              data.date < today ||
              data.date > "2026-12-28" ||
              new Date(data.date + "T12:00:00Z").toISOString().slice(0, 10) !==
                data.date
            )
              fail("Проверьте корпус и дату");
            for (const t of [data.time, data.end])
              if (!/^([01]\d|2[0-3]):(00|30)$/.test(t))
                fail("Выберите время с шагом 30 минут");
            Object.assign(r, {
              short: room.short,
              name:
                room.short === gym.short
                  ? "Место в спортзале Н-101"
                  : room.name,
              building: room.building,
              date: data.date,
              time: data.time,
              end: data.end,
            });
            const dur = numberTime(r.end) - numberTime(r.time);
            if (dur < 30 || dur > 240 || r.time < "09:00" || r.end > "22:00")
              fail(
                "Доступно от 30 минут до четырёх часов в пределах 09:00–22:00",
              );
            checkRoom(r);
            if (
              list().some(
                (o) =>
                  o.owner === owner &&
                  o.status === "pending" &&
                  o.short === r.short &&
                  o.date === r.date &&
                  o.time === r.time &&
                  o.end === r.end,
              )
            )
              fail("Такая заявка уже рассматривается", 409);
          } else if (
            r.kind === "document" &&
            people[owner].role === "student"
          ) {
            const cert = catalogue["Справки"].includes(data.name);
            if (!cert && !catalogue["Заявления"].includes(data.name))
              fail("Выберите услугу");
            if (cert && !["Электронная", "Бумажная"].includes(data.format))
              fail("Выберите формат");
            const service = services.find((s) => s.name === data.name);
            try {
              r.details = submittedFields(
                service,
                data.values || {},
                people[owner],
              );
            } catch (e) {
              fail(e.message);
            }
            if (data.attachment) {
              const { name, mime, base64 } = data.attachment;
              const signatures = {
                "application/pdf": "255044462d",
                "image/png": "89504e470d0a1a0a",
                "image/jpeg": "ffd8ff",
              };
              if (
                !Object.hasOwn(signatures, mime) ||
                typeof base64 !== "string" ||
                !name ||
                typeof name !== "string"
              )
                fail("Допустимы PDF, PNG и JPEG");
              const content = Buffer.from(base64, "base64");
              if (
                content.length > 2097152 ||
                !content.toString("hex", 0, 8).startsWith(signatures[mime])
              )
                fail("Проверьте формат и размер файла");
              r.attachment = name.replace(/[\\/\r\n]/g, "_").slice(0, 150);
              db.prepare("INSERT INTO attachments VALUES(?,?,?,?)").run(
                r.id,
                r.attachment,
                mime,
                content,
              );
            }
            if (service.fields.some((field) => field.id === "program"))
              r.requirements = transferRequirements(
                data.values.program,
                people[owner],
              );
            Object.assign(r, {
              name: data.name,
              format: cert ? data.format : "Заявление",
              comment: String(data.comment || "").slice(0, 2500),
            });
          } else fail("Услуга недоступна", 403);
          put(r);
          note(
            "office",
            "Новое обращение",
            people[owner].name + " · " + r.name,
            2,
            r.id,
          );
          result = { id: r.id };
        } else if (["clarify", "supplement"].includes(action)) {
          const r = list().find((x) => x.id === data.id);
          if (!r || r.kind !== "document") fail("Обращение не найдено", 404);
          const asking = action === "clarify",
            body = String(data.body || "").trim();
          if (asking ? owner !== "office" : owner !== r.owner)
            fail("Нет доступа", 403);
          if (r.status !== (asking ? "pending" : "clarification"))
            fail("Статус обращения изменился", 409);
          if (!body || body.length > 2500)
            fail("Введите текст до 2500 символов");
          r.status = asking ? "clarification" : "pending";
          (r.discussion ||= []).push({
            sender: owner,
            body,
            created: Date.now(),
          });
          put(r);
          const recipient = asking ? r.owner : "office",
            title = asking
              ? "Нужны сведения по заявке"
              : "Студент дополнил обращение";
          note(recipient, title, r.name + " · " + body, 4, r.id);
          delivery = [recipient, title];
        } else if (["decision", "cancel"].includes(action)) {
          const r = list().find((o) => o.id === data.id);
          if (!r) fail("Заявка не найдена", 404);
          if (action === "cancel") {
            if (
              owner !== r.owner ||
              !["pending", "approved"].includes(r.status) ||
              r.kind !== "booking"
            )
              fail("Отмена недоступна", 403);
            r.status = "cancelled";
          } else {
            if (owner !== "office") fail("Решение принимает деканат", 403);
            if (r.status !== "pending") fail("Заявка уже обработана", 409);
            if (!["approved", "rejected"].includes(data.status))
              fail("Выберите решение");
            if (data.status === "approved" && r.kind === "booking")
              checkRoom(r, r.id);
            r.status = data.status;
            r.reason = String(data.reason || "").slice(0, 1200);
            if (
              r.kind === "document" &&
              r.format === "Электронная" &&
              r.status === "approved"
            )
              r.expires = Date.now() + ttl;
            const title =
              r.kind === "booking"
                ? r.status === "approved"
                  ? "Бронь одобрена"
                  : "Бронь отклонена"
                : r.status === "approved"
                  ? "Обращение одобрено"
                  : "Обращение отклонено";
            delivery = [r.owner, title];
            note(
              r.owner,
              title,
              r.name +
                (r.kind === "booking"
                  ? " · " + r.date + " · " + r.time + "–" + r.end
                  : "") +
                (r.reason ? "\n\n" + r.reason : ""),
              4,
              r.id,
            );
          }
          put(r);
        } else if (action === "letter") {
          if (owner !== "office") fail("Отправитель — деканат", 403);
          if (
            !Object.hasOwn(people, data.to) ||
            data.to === owner ||
            !data.subject?.trim() ||
            !data.body?.trim()
          )
            fail("Заполните получателя, тему и текст");
          delivery = [data.to, "Новое письмо деканата"];
          note(
            data.to,
            data.subject.trim().slice(0, 140),
            data.body.trim().slice(0, 12000),
            3,
          );
        } else fail("Команда не найдена", 404);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      if (delivery) void push.deliver(...delivery);
      reply(result);
    } catch (e) {
      res.statusCode = e.status || 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: e.status ? e.message : "Не удалось обработать запрос",
        }),
      );
    }
  }
  return {
    name: "campus-demo-api",
    configureServer(s) {
      s.middlewares.use(handle);
    },
    configurePreviewServer(s) {
      s.middlewares.use(handle);
    },
  };
}
