import { programNames, residences } from "./university.js";

// Each category has one outline pictogram shared by its cards and form.
export const groups = [
  [
    "digital",
    "Электронные документы",
    "#226448",
    "#E3F2E8",
    "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8 M14 3v5h5l-5-5 M19 8v4 M12 16l3 3 6-7",
  ],
  [
    "study",
    "Учёба",
    "#985024",
    "#FAEBDD",
    "M3 9l9-5 9 5-9 5-9-5z M6 11v5q6 5 12 0v-5 M21 9v7",
  ],
  [
    "documents",
    "Заказ документов",
    "#72558A",
    "#F0EAF5",
    "M9 3h6l4 4v10H9z M15 3v5h4 M6 7H5v14h10v-1",
  ],
  [
    "leave",
    "Академический отпуск",
    "#8B651F",
    "#F8EFD8",
    "M20 10a8 8 0 1 0-2 8 M12 7v5l3 2 M17 4l4 1-1 4",
  ],
  [
    "support",
    "Стипендии и поддержка",
    "#934863",
    "#F7E6ED",
    "M3 16h4l3-3h4a2 2 0 0 1 0 4h-3 M14 17l5-3q3-1 2 2l-6 5H8l-5-2 M11 5q2-3 4 0 3-3 4 0 1 2-4 6-5-4-4-6z",
  ],
  [
    "identity",
    "Личные данные",
    "#2B716A",
    "#E2F0EB",
    "M3 5h18v14H3z M6 15q2-4 5 0 M7 9a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0 M14 9h4 M14 13h3",
  ],
  [
    "housing",
    "Общежития",
    "#406889",
    "#E5EEF5",
    "M3 10l9-7 9 7 M5 9v11h14V9 M10 20v-7h4v7",
  ],
].map(([id, title, ink, bg, path]) => ({ id, title, ink, bg, path }));

const definitions = {
  destination: ["Куда предоставить", "text"],
  period: [
    "Учебный период",
    "select",
    ["Текущий семестр", "Предыдущий семестр", "Весь период обучения"],
  ],
  order: [
    "Вид приказа",
    "select",
    ["Зачисление", "Перевод", "Назначение стипендии"],
  ],
  subject: ["Дисциплина", "text"],
  group: ["Учебная группа", "select", ["АД-21", "АД-22", "АД-32"]],
  program: ["Новая программа", "program"],
  reason: ["Основание обращения", "textarea"],
  email: ["Электронная почта", "email"],
  phone: ["Контактный телефон", "tel"],
  start: ["Дата начала", "date"],
  end: ["Дата окончания", "date"],
  original: ["Документ", "select", ["Аттестат", "Диплом"]],
  change: ["Какие сведения изменить", "textarea"],
  residence: ["Общежитие", "select", residences],
  room: ["Номер комнаты", "text"],
  issue: ["Что требует ремонта", "textarea"],
  organisation: ["Организация", "text"],
  achievements: ["Достижения за семестр", "textarea"],
  topic: ["Тема консультации", "text"],
};
export const fields = Object.fromEntries(
  Object.entries(definitions).map(([id, [label, type, options]]) => [
    id,
    { id, label, type, options },
  ]),
);
const rows = [
  ["digital", "Справка об обучении", "destination", 1],
  ["digital", "Выписка из зачётной книжки", "period", 1],
  ["study", "Перевод на другую программу", "program reason email"],
  ["study", "Индивидуальный учебный план", "group period reason"],
  ["study", "Запись на консультацию", "subject topic email"],
  ["study", "Продление срока аттестации", "subject end reason"],
  ["study", "Заявка на стажировку", "organisation start end email"],
  ["study", "Перезачёт дисциплины", "subject organisation reason"],
  ["documents", "Справка о периоде обучения", "period destination", 1],
  ["documents", "Справка о размере стипендии", "period destination", 1],
  ["documents", "Справка об отсутствии стипендии", "period destination", 1],
  ["documents", "Справка для общежития", "residence", 1],
  [
    "documents",
    "Справка для предоставления по месту требования",
    "destination",
    1,
  ],
  ["documents", "Выписка из приказа", "order", 1],
  ["documents", "Копия аттестата или диплома", "original destination", 1],
  ["documents", "Временная выдача оригинала документа", "original end phone"],
  ["documents", "Справка-вызов", "organisation start end", 1],
  ["documents", "Архивная справка", "period destination", 1],
  ["documents", "Характеристика с места учёбы", "destination", 1],
  ["leave", "Академический отпуск", "start end reason phone"],
  ["leave", "Продление академического отпуска", "end reason phone"],
  ["leave", "Выход из академического отпуска", "start group email"],
  ["support", "Материальная помощь", "reason phone"],
  ["support", "Назначение социальной стипендии", "reason period email"],
  ["support", "Повышенная академическая стипендия", "period achievements"],
  ["identity", "Восстановление студенческого билета", "reason phone"],
  ["identity", "Изменение персональных данных", "change email"],
  ["identity", "Замена пропуска", "reason phone"],
  ["housing", "Заселение в общежитие", "residence start phone"],
  ["housing", "Обращение в поддержку общежития", "residence reason email"],
  ["housing", "Заявка на ремонт в общежитии", "residence room issue phone"],
];
export const services = rows.map(([group, name, keys, certificate]) => ({
  group,
  name,
  fields: keys.split(" ").map((k) => fields[k]),
  certificate: !!certificate,
}));
export const catalogue = Object.fromEntries(
  [
    ["Справки", true],
    ["Заявления", false],
  ].map(([k, v]) => [
    k,
    services.filter((s) => s.certificate === v).map((s) => s.name),
  ]),
);
export function choices(field, person) {
  return field.type === "program"
    ? programNames.filter((p) => p !== person.program)
    : field.options;
}
export function submittedFields(service, values, person) {
  const details = {};
  for (const f of service.fields) {
    const v = String(values?.[f.id] ?? "").trim(),
      options = choices(f, person);
    if (
      !v ||
      v.length > (f.type === "textarea" ? 2000 : 200) ||
      (options && !options.includes(v)) ||
      (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ||
      (f.type === "tel" && !/^\+?[\d ()-]{7,25}$/.test(v)) ||
      (f.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v))
    )
      throw Error("Проверьте поле «" + f.label + "»");
    details[f.label] = v;
  }
  if (values.start && values.end && values.end < values.start)
    throw Error("Дата окончания раньше даты начала");
  return details;
}
