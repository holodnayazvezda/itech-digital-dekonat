// All names and assignments describe the fictional university in the demo.
export const schools = [
  ["data", "Факультет аналитики", "Орлова Елена Николаевна", [
    ["АД", "Прикладная аналитика", "Кафедра аналитики"],
    ["АБ", "Аналитика бизнеса", "Кафедра бизнес-информатики"],
  ], "Кафедра математических методов"],
  ["management", "Факультет управления", "Ветров Андрей Петрович", [
    ["УП", "Управление проектами", "Кафедра управления проектами"],
    ["ГУ", "Государственное управление", "Кафедра публичного управления"],
  ], "Кафедра организационного развития"],
  ["humanities", "Гуманитарный факультет", "Кирова Ольга Сергеевна", [
    ["КЛ", "Культурология", "Кафедра культурологии"],
    ["ИВ", "История и архивное дело", "Кафедра исторических исследований"],
  ], "Кафедра философии"],
  ["languages", "Факультет иностранных языков", "Ясина Ирина Львовна", [
    ["МК", "Межкультурная коммуникация", "Кафедра межкультурной коммуникации"],
    ["ПВ", "Перевод и переводоведение", "Кафедра перевода"],
  ], "Кафедра прикладной лингвистики"],
  ["law", "Международно-правовой факультет", "Горин Пётр Ильич", [
    ["МП", "Международное право", "Кафедра международного права"],
    ["ЦП", "Цифровое право", "Кафедра информационного права"],
  ], "Кафедра теории права"],
  ["sport", "Факультет общеуниверситетской подготовки", "Белов Игорь Антонович", [
    ["СМ", "Спортивный менеджмент", "Кафедра спортивного менеджмента"],
    ["ФК", "Физическая культура", "Кафедра физической культуры"],
  ], "Кафедра здоровья и адаптации"],
  ["relations", "Факультет международных отношений", "Речнева Алёна Михайловна", [
    ["МО", "Международные отношения", "Кафедра дипломатии"],
    ["РВ", "Зарубежное регионоведение", "Кафедра регионоведения"],
  ], "Кафедра мировой политики"],
  ["economics", "Экономический факультет", "Полесов Юрий Андреевич", [
    ["МЭ", "Мировая экономика", "Кафедра мировой экономики"],
    ["ФН", "Финансы и кредит", "Кафедра финансов"],
  ], "Кафедра экономической теории"],
];

const surnames = "Алферов Астафьев Барсов Бахтин Беляев Березин Бобров Веселов Виноградов Власов Волгин Воронов Гвоздев Глебов Голубев Грачев Данилов Демидов Денисов Дорофеев Дубровин Ершов Жданов Жуков Зайцев Звягинцев Зорин Ильин Исаев Капустин Карпов Киселев Ковалев Колосов Корнеев Косарев Котов Кравцов Крылов Кудрин Лапин Лебедев Литвинов Луговой Макаров Маслов Медведев Миронов Михеев Морозов Назаров Нестеров Никитин Озеров Орлов Павлов Пахомов Перов Петров Платонов Поляков Романов Рыбаков Савельев Семенов Сергеев Серов Синицын Соколов Сомов Степанов Тихонов Уваров Федоров Филатов Харитонов Цветков Чернов Шаров Шилов".split(" ");
const names = [
  "Александр Андрей Антон Артём Борис Вадим Валентин Василий Виктор Владимир Владислав Георгий Денис Дмитрий Иван Игорь Кирилл Леонид Максим Михаил Никита Олег Павел Пётр Роман Сергей Тимофей Фёдор Юрий Ярослав",
  "Александра Алёна Алиса Алина Алла Анастасия Анна Арина Валентина Валерия Варвара Вера Вероника Виктория Галина Дарья Ева Екатерина Елена Ирина Кира Ксения Лидия Марина Мария Надежда Ольга Полина Софья Юлия",
].map(line => line.split(" "));
const patronymics = [
  "Александрович Андреевич Борисович Васильевич Викторович Владимирович Дмитриевич Евгеньевич Игоревич Кириллович Максимович Михайлович Павлович Сергеевич Фёдорович Юрьевич",
  "Александровна Андреевна Борисовна Васильевна Викторовна Владимировна Дмитриевна Евгеньевна Игоревна Кирилловна Максимовна Михайловна Павловна Сергеевна Фёдоровна Юрьевна",
].map(line => line.split(" "));

// A permutation of the finite name combinations keeps IDs and names stable on every build.
function fictionalName(serial) {
  const sex = serial % 2;
  const capacity = surnames.length * names[sex].length * patronymics[sex].length;
  let index = (Math.floor(serial / 2) * 7919 + 413 + sex * 3707) % capacity;
  let surname = surnames[index % surnames.length];
  if (sex) surname = surname.endsWith("ой") ? surname.slice(0,-2) + "ая" : surname + "а";
  index = Math.floor(index / surnames.length);
  return [surname, names[sex][index % names[sex].length], patronymics[sex][Math.floor(index / names[sex].length)]].join(" ");
}

export function makeInstitution(existing, appointments) {
  const people = {...existing};
  const faculties = [], departments = {}, programs = {}, groupDirectory = {}, teachingGroups = {};
  function addPerson(id, person) {
    const initials = person.name.split(" ").slice(0,2).map(w => w[0]).join("");
    people[id] = {...person, id, initials, caption: person.role === "student"
      ? `Бакалавриат · ${person.course} курс · ${person.unit}`
      : `${person.title} · ${person.unit}`};
  }
  let studentNumber = 10000;
  let teacherNumber = 10000;
  for (const [slug, name, deanName, courses, generalChair] of schools) {
    const dean = "dean-" + slug;
    const faculty = {id: slug, name, dean, programs: courses.map(([,label]) => label), departments: []};
    faculties.push(faculty);
    if (!people[dean]) addPerson(dean, {name:deanName, title:"Декан", role:"staff", unit:name, number:"ДН-" + String(faculties.length).padStart(5,"0")});
    Object.assign(people[dean], {faculty:name, facultyId:slug});
    for (const [index, title] of [...courses.map(([, , dept])=>dept), generalChair].entries()) {
      const id = slug + "-" + (index + 1);
      const department = {id, name:title, facultyId:slug, programs:[], staff:[], chair:""};
      departments[id] = department;
      faculty.departments.push(id);
      for (let i=0; i<8; i++) {
        const number = ++teacherNumber;
        const staffId = "faculty-" + number;
        addPerson(staffId, {name:fictionalName(number + 6100), role:"teacher", number:"ПР-" + number,
          unit:title, title:i === 0 ? "Заведующий кафедрой" : i < 3 ? "Профессор" : i < 6 ? "Доцент" : "Преподаватель",
          faculty:name, facultyId:slug, department:id});
        department.staff.push(staffId);
        if (i === 0) department.chair = staffId;
      }
    }
    for (const [index, [code, label]] of courses.entries()) {
      const responsible = faculty.departments[index];
      const common = faculty.departments[2];
      const program = programs[label] = {name:label, code, facultyId:slug, department:responsible, groups:[]};
      departments[responsible].programs.push(label);
      departments[common].programs.push(label);
      for (let course=1; course<=4; course++) {
        for (let stream=1; stream<=3; stream++) {
          const groupCode = code + "-" + course + stream;
          const group = groupDirectory[groupCode] = {code:groupCode, course, program:label, facultyId:slug, students:[], teachers:[]};
          program.groups.push(groupCode);
          const slots = 23 + ((course + stream + index) % 5);
          const legacy = groupCode === "АД-21" ? "student" : groupCode === "АД-32" ? "friend" : null;
          if (legacy) {
            Object.assign(people[legacy], {facultyId:slug, course, department:responsible,
              caption:`Бакалавриат · ${course} курс · ${groupCode}`});
            group.students.push(legacy);
          }
          while (group.students.length < slots) {
            const number = ++studentNumber;
            const id = "student-" + number;
            addPerson(id, {name:fictionalName(number-10000), number:"СТ-" + number, role:"student", title:"Студент",
              unit:groupCode, faculty:name, facultyId:slug, program:label, department:responsible, course,
              card:`${27-course}-${number}`});
            group.students.push(id);
          }
          // The two original student groups keep their authored timetables.
          if (legacy) continue;
          for (const [dept, offset] of [[responsible,0],[responsible,3],[common,1]]) {
            const staff = departments[dept].staff;
            group.teachers.push(staff[(course * 3 + stream + offset) % staff.length]);
          }
        }
      }
    }
  }

  // Appointments and classes for the historical demonstration accounts.
  for (const [id, [dept, ...groups]] of Object.entries(appointments)) {
    const d = departments[dept], person = people[id];
    Object.assign(person, {department:dept, facultyId:d.facultyId, faculty:faculties.find(f=>f.id===d.facultyId).name});
    d.staff.push(id);
    for (const code of groups) groupDirectory[code].teachers.push(id);
  }
  for (const g of Object.values(groupDirectory)) {
    for (const id of g.teachers) (teachingGroups[id] ||= []).push(g.code);
  }
  return {people, faculties, departments, programs, groupDirectory, teachingGroups};
}
