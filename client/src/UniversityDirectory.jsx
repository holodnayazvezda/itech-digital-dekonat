import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, UsersRound, ChevronRight, X } from "lucide-react";
import AccountSelect from "./AccountSelect.jsx";
import { teachingDays } from "../shared/campus-data.js";
import {
  directoryPeople as people, faculties, departments, programs, groupDirectory, teachingGroups,
} from "../shared/university.js";
import "./university-directory.css";
import "./people.css";
import { searchScore } from "../shared/search.js";

const facultyById = Object.fromEntries(faculties.map(f => [f.id, f]));
const compareRussian = new Intl.Collator("ru", { numeric: true }).compare;
const pageSize = 24;
const searchIndex = Object.values(people).map(person => ({
  person,
  searchText: [
    person.name, person.number, person.unit, person.title, person.program, person.faculty,
    departments[person.department]?.name,
  ].join(" "),
}));

function PersonRow({person, avatars, onGo}) {
  return <button className="person-row" onClick={() => onGo("person", person.id)}>
    {avatars?.[person.id] ? <img src={avatars[person.id]} alt="" /> : <i aria-hidden="true">{person.initials}</i>}
    <span className="person-row-copy"><strong>{person.name}</strong><small>{[person.title,person.unit].filter(Boolean).join(' · ')}</small></span>
    <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
  </button>;
}

function PeopleList({ids, avatars, onGo}) {
  return <div className="people-grid">
    {ids.map(id => <PersonRow key={id} person={people[id]} avatars={avatars} onGo={onGo} />)}
  </div>;
}

export function PeopleDirectory({initial, avatars, onGo}) {
  const [query, setQuery] = useState(initial);
  const [faculty, setFaculty] = useState("");
  const [role, setRole] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const results = useMemo(() => {
    const term = query.trim();
    return searchIndex.filter(({ person, searchText }) =>
      (!faculty || person.facultyId === faculty) &&
      (!role || person.role === role) &&
      (!term || searchScore(term, searchText, { names: true }) > 0)
    );
  }, [query, faculty, role]);
  return <div className="people-directory">
    <div className="hub-controls directory-tools">
      <label className="hub-search">
        <Search size={17} strokeWidth={1.7} aria-hidden="true" />
        <input type="search" aria-label="ФИО или табельный номер" placeholder="ФИО или табельный номер"
          value={query} onChange={e => { setQuery(e.target.value); setLimit(pageSize); }} />
      </label>
      <AccountSelect label="Факультет" value={faculty} onChange={value=>{setFaculty(value);setLimit(pageSize);}}
        options={[{value:"",label:"Все факультеты"},...faculties.map(f=>({value:f.id,label:f.name}))]}/>
      <AccountSelect label="Роль" value={role} onChange={value=>{setRole(value);setLimit(pageSize);}}
        options={[{value:"",label:"Все участники"},{value:"student",label:"Студенты"},{value:"teacher",label:"Преподаватели"},{value:"staff",label:"Сотрудники"},{value:"office",label:"Деканат"}]}/>
    </div>
    <div className="directory-count"><span role="status">Участники · {results.length.toLocaleString("ru-RU")}</span>{(query || faculty || role) && <button className="directory-reset" onClick={()=>{setQuery('');setFaculty('');setRole('');setLimit(pageSize);}}><X size={13} aria-hidden="true"/>Сбросить</button>}</div>
    <div className="people-grid">
      {results.slice(0, limit).map(({ person }) => (
        <PersonRow key={person.id} person={person} avatars={avatars} onGo={onGo} />
      ))}
    </div>
    {!results.length && <div className="people-empty"><UsersRound size={30} strokeWidth={1.5}/><h2>Никого не нашли</h2><p>Попробуйте другое имя или измените фильтры.</p></div>}
    {results.length > limit && <button className="directory-more" onClick={() => setLimit(limit + pageSize)}>Показать ещё</button>}
  </div>;
}

function UnitLink({label, description, onClick, own}) {
  return <button className={'unit-link' + (own ? ' own' : '')} onClick={onClick}>
    <span><strong>{label}</strong>{description && <small>{description}</small>}</span><span aria-hidden="true">›</span>
  </button>;
}
function GroupLinks({codes, own, onGo}) {
  return <div className="unit-groups">{codes.map(code => <button key={code}
    className={code===own ? "own" : ""} onClick={() => onGo("structure", "group/" + code)}>{code}</button>)}</div>;
}

function TeachingOverview({ person, lessonChanges, onGo }) {
  const subjects = useMemo(() => {
    const groupsBySubject = new Map();
    for (const { events } of teachingDays(person.name, lessonChanges)) {
      for (const { name, group } of events) {
        if (!Object.hasOwn(groupDirectory, group)) continue;
        if (!groupsBySubject.has(name)) groupsBySubject.set(name, new Set());
        groupsBySubject.get(name).add(group);
      }
    }
    return [...groupsBySubject].sort(([first], [second]) => compareRussian(first, second));
  }, [person.name, lessonChanges]);
  const scheduledGroups = new Set(subjects.flatMap(([, groups]) => [...groups]));
  const otherGroups = (teachingGroups[person.id] || []).filter(code => !scheduledGroups.has(code));
  if (!subjects.length && !otherGroups.length) return null;

  return <>
    {subjects.length > 0 && <section aria-label="Дисциплины и группы">
      <h3>Дисциплины и группы</h3>
      <ul className="teacher-subjects">
        {subjects.map(([name, groups]) => <li key={name}>
          <h4>{name}</h4>
          <GroupLinks codes={[...groups].sort(compareRussian)} onGo={onGo} />
        </li>)}
      </ul>
    </section>}
    {otherGroups.length > 0 && <>
      <h3>Учебные группы</h3>
      <GroupLinks codes={otherGroups} onGo={onGo} />
    </>}
  </>;
}

export function PersonProfile({person, avatars, lessonChanges, onGo}) {
  const name = useRef(null);
  useLayoutEffect(() => { name.current?.focus({preventScroll:true}); }, [person.id]);
  const d = departments[person.department];
  const f = facultyById[person.facultyId];
  return <article className="person-page">
    {avatars?.[person.id] ? <img src={avatars[person.id]} alt="" /> : <i aria-hidden="true">{person.initials}</i>}
    <h1 ref={name} tabIndex={-1}>{person.name}</h1><p>{person.title} · {person.unit}</p><small>Табельный номер · {person.number}</small>
    {f && <div className="person-units">
      <UnitLink label={f.name} description="Факультет" onClick={() => onGo("structure","faculty/"+f.id)} />
      {d && <UnitLink label={d.name} description="Кафедра" onClick={() => onGo("structure","department/"+d.id)} />}
      {person.role === "student" && <>
        <UnitLink label={person.program} description="Образовательная программа" onClick={() => onGo("structure","program/"+person.program)} />
        <UnitLink label={"Группа "+person.unit} description={person.course+" курс"} onClick={() => onGo("structure","group/"+person.unit)} />
      </>}
    </div>}
    {person.role === "teacher" && <TeachingOverview person={person} lessonChanges={lessonChanges} onGo={onGo} />}
  </article>;
}

export function UniversityStructure({path, owner, avatars, onGo}) {
  const me = people[owner];
  const [kind,key] = path.split("/");
  const faculty = facultyById[key];
  const department = departments[key];
  const program = programs[key];
  const group = groupDirectory[key];
  const link = (kind, key) => () => onGo("structure", kind + "/" + key);
  const programLink = name => <UnitLink key={name} label={name} own={me.program === name}
    description={me.program === name ? "Ваше направление" : "Бакалавриат · 4 года"} onClick={link("program",name)} />;
  const list = ids => <PeopleList ids={ids} avatars={avatars} onGo={onGo} />;
  if (kind === "group" && group) return <div className="org-page">
    <h2>Группа {group.code}</h2><button className="text-link" onClick={link("program",group.program)}>{group.program} ↗</button>
    <p className="org-meta">{group.course} курс · {facultyById[group.facultyId].name}</p>
    <h3>Преподаватели группы</h3>{list(group.teachers)}
    <h3>Студенты · {group.students.length}</h3>{list(group.students)}
  </div>;
  if (kind === "program" && program) return <div className="org-page">
    <h2>{program.name}</h2><p className="org-meta">Бакалавриат · 4 года · 240 з. е.</p>
    <UnitLink label={departments[program.department].name} description="Выпускающая кафедра" onClick={link("department",program.department)} />
    <button className="text-link" onClick={() => onGo("plan",program.name)}>Открыть учебный план ↗</button>
    <h3>Учебные группы</h3>
    {[1,2,3,4].map(course => <section className="cohort" key={course}><h4>{course} курс</h4>
      <GroupLinks codes={program.groups.filter(c=>groupDirectory[c].course===course)} own={me.unit} onGo={onGo} /></section>)}
  </div>;
  if (kind === "department" && department) return <div className="org-page">
    <h2>{department.name}</h2><button className="text-link" onClick={link("faculty",department.facultyId)}>{facultyById[department.facultyId].name} ↗</button>
    <h3>Заведующий кафедрой</h3>{list([department.chair])}
    <h3>Образовательные программы</h3><div className="unit-grid">{department.programs.map(programLink)}</div>
    <h3>Состав кафедры</h3>{list(department.staff.filter(id=>id!==department.chair))}
  </div>;
  if (kind === "faculty" && faculty) return <div className="org-page">
    <h2>{faculty.name}</h2><h3>Декан</h3>{list([faculty.dean])}
    <h3>Кафедры</h3><div className="unit-grid">{faculty.departments.map(id =>
      <UnitLink key={id} label={departments[id].name} description={"Сотрудников: "+departments[id].staff.length} onClick={link("department",id)} />)}</div>
    <h3>Образовательные программы</h3><div className="unit-grid">{faculty.programs.map(programLink)}</div>
  </div>;
  return <div className="org-page"><h2>Факультеты</h2><div className="unit-grid">{faculties.map(f =>
    <UnitLink key={f.id} label={f.name} own={me.facultyId===f.id} description={me.facultyId===f.id ? "Ваш факультет" : f.programs.join(" · ")} onClick={link("faculty",f.id)} />)}</div>
    <h2>Ректорат</h2>{list(["vice-study","vice-science"])}
  </div>;
}
