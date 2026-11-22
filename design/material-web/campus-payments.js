// The demo student's first semester started in September 2025.
export const financePeriods = Array.from({ length: 15 }, (_, i) =>
  new Date(Date.UTC(2026, 10 - i, 1)).toISOString().slice(0, 7),
);
// Award periods for the demo student; the ledger only includes active awards.
const studentAwards = [
  {
    line: ["Государственная академическая", 4500, "Базовая стипендия"],
    periods: [["2025-09", "2026-11"]],
  },
  {
    line: ["Повышенная академическая (ПГАС)", 7000, "За учебные достижения"],
    periods: [
      ["2025-10", "2026-08"],
      ["2026-10", "2026-11"],
    ],
  },
  {
    line: ["Именная стипендия партнёра", 5000, "Программа партнёра"],
    periods: [
      ["2025-11", "2025-11"],
      ["2026-11", "2026-11"],
    ],
  },
];
export function payment(role, month, owner = role) {
  const [year, m] = month.split("-").map(Number);
  const nextPayDate = new Date(Date.UTC(year, m, 5)).toISOString().slice(0, 10);
  const hours = [44, 48, 48, 52, 48, 44, 28, 32, 44, 52, 48, 44][m - 1];
  const lines =
    role === "teacher"
      ? [
          ["Учебная нагрузка", hours * 1000, hours + " ч × 1 000 ₽"],
          ["Методическая работа", 12000, "Фиксированная доплата"],
          ...(owner === "teacher"
            ? [["Кураторство", 5000, "Группа АД-21"]]
            : []),
        ]
      : (owner === "friend" ? studentAwards.slice(0, 1) : studentAwards)
          .filter((award) =>
            award.periods.some(([from, to]) => month >= from && month <= to),
          )
          .map((award) => award.line);
  const total = lines.reduce((s, l) => s + l[1], 0),
    advance = role === "teacher" ? 20000 : 0;
  return {
    lines,
    total,
    transfers:
      role === "teacher"
        ? [
            [month + "-20", "Аванс", advance],
            [nextPayDate, "Окончательный расчёт", total - advance],
          ]
        : lines.length
          ? [[nextPayDate, "Стипендия за месяц", total]]
          : [],
  };
}
