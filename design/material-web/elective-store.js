import { electiveOptions } from "./electives.js";

export function electiveStore(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS elective_selections(owner TEXT PRIMARY KEY, course TEXT NOT NULL)",
  );
  const selected = db.prepare(
    "SELECT course FROM elective_selections WHERE owner=?",
  );
  const counts = db.prepare(
    "SELECT course,COUNT(*) AS used FROM elective_selections GROUP BY course",
  );
  function state(owner) {
    const used = Object.fromEntries(
      counts.all().map((row) => [row.course, row.used]),
    );
    return {
      selected: selected.get(owner)?.course || "",
      remaining: Object.fromEntries(
        electiveOptions.map((o) => [
          o.id,
          o.availableAtOpening - (used[o.id] || 0),
        ]),
      ),
    };
  }
  // Caller holds BEGIN IMMEDIATE through validation and write.
  function choose(owner, course, previous) {
    const option = electiveOptions.find((o) => o.id === course);
    if (!option)
      throw Object.assign(Error("Выберите дисциплину из списка"), {
        status: 400,
      });
    const current = state(owner);
    if (current.selected === course) return false;
    if (current.selected !== previous || current.remaining[course] <= 0)
      throw Object.assign(
        Error("Выбор или число мест изменились. Проверьте доступные варианты."),
        { status: 409 },
      );
    db.prepare(
      "INSERT INTO elective_selections(owner,course) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET course=excluded.course",
    ).run(owner, course);
    return true;
  }
  return { state, choose };
}
