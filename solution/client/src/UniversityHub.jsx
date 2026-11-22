import DocumentIcon, { documentHint } from "./DocumentIcon.jsx";
import { ClipboardList, FileSearch, ArrowRight, X } from "lucide-react";
import ChatInbox from "./ChatInbox.jsx";
import { PeopleDirectory, PersonProfile, UniversityStructure } from "./UniversityDirectory.jsx";
import HousingView, { ResidenceDetails } from "./HousingView.jsx";
import Electives from "./Electives.jsx";
import { electiveOptions, electiveSemester } from "../shared/electives.js";
import { groups, services } from "../shared/services.js";
import {
  directoryPeople as people,
  curriculum,
  programNames,
} from "../shared/university.js";
import { computed, useSignal } from "@preact/signals-react";
import { useRef, Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useWatch, afterPaint, classNames } from "./ui.jsx";
export default function UniversityHub(props) {
  useSignals();

  const query = useSignal(["directory", "docs"].includes(props.view) ? props.peer || "" : ""),
    collapsed = useSignal({}),
    program = useSignal(props.view === "plan" && programNames.includes(props.peer) ? props.peer : people[props.owner].program || programNames[0]),
    semester = useSignal(people[props.owner].program === program.value ? people[props.owner].course * 2 - 1 : 1),
    draft = useSignal(""),
    log = useRef(null);
  const me = computed(() => people[props.owner]),
    peer = computed(() => people[props.peer]);
  const ownPlan = computed(
    () => me.value.role === "student" && me.value.program === program.value,
  );
  const selected = computed(() =>
    electiveOptions.find((o) => o.id === props.electives?.selected),
  );
  useWatch(
    () => [props.view, props.peer],
    () => {
      if (props.view === "plan" && props.peer === "electives") {
        program.value = me.value.program;
        semester.value = electiveSemester;
      }
    },
    { immediate: true },
  );
  const match = (s) =>
    s.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[ -]/g, "");
  const matches = (s) => match(s).includes(match(query.value.trim()));
  const catalog = computed(() =>
    groups
      .map((g) => ({
        ...g,
        items: services.filter(
          (s) => s.group === g.id && (matches(s.name) || matches(g.title)),
        ),
      }))
      .filter((g) => g.items.length),
  );

  const dialog = computed(() =>
    props.messages.filter(
      (m) => (m.sender === props.owner ? m.recipient : m.sender) === props.peer,
    ),
  );
  const time = (t) =>
    new Date(t).toLocaleString("ru", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
  async function send() {
    if (
      draft.value.trim() &&
      (await props.send("message", {
        to: props.peer,
        body: draft.value.trim(),
      }))
    )
      draft.value = "";
  }
  useWatch(
    () => [props.view, props.peer],
    () => {
      query.value = ["directory", "docs"].includes(props.view) ? props.peer || "" : "";
      draft.value = "";
    },
  );
  useWatch(
    () => [props.view, dialog.value.at(-1)?.id],
    async () => {
      await afterPaint();
      if (log.current) log.current.scrollTop = log.current.scrollHeight;
    },
    { immediate: true },
  );

  return (
    <>
      <div className={"uni-hub"}>
        {!props.rootPlan && !["docs","directory","person","dorm","residence"].includes(props.view) ? (
          <button
            onClick={(event) => {
              props.onBack?.();
            }}
            className={"text-link hub-back"}
          >
            {" ← Назад "}
          </button>
        ) : null}
        {props.view === "docs" ? (
          <div className="docs-catalog">
            <div className="docs-toolbar"><div className={"hub-search"} role="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <input
                value={query.value ?? ""}
                onChange={(event) => {
                  query.value = event.target.value;
                  collapsed.value = {};
                }}
                type="search"
                aria-label="Найти справку или заявление"
                placeholder="Найти справку или заявление"
              />
              {query.value && <button className="docs-search-clear" aria-label="Очистить поиск документов" onClick={() => {query.value = "";}}><X size={16}/></button>}
            </div><button className="docs-my-requests" onClick={() => props.onGo?.("booked")}><ClipboardList size={17} strokeWidth={1.8}/>Мои заявки<ArrowRight size={15}/></button></div>
            {catalog.value.map((g) => (
              <section key={g.id} className={"doc-section"}>
                <button
                  aria-label={g.title}
                  aria-controls={"doc-group-" + g.id}
                  aria-expanded={!collapsed.value[g.id]}
                  onClick={(event) => {
                    collapsed.value = {
                      ...collapsed.value,
                      [g.id]: !collapsed.value[g.id],
                    };
                  }}
                  className={"section-toggle"}
                >
                  <span className="docs-category-title">{g.title}</span>
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className={classNames({
                      closed: collapsed.value[g.id],
                    })}
                  >
                    <path d="m4 10 4-4 4 4" />
                  </svg>
                </button>
                <div className="doc-reveal" id={"doc-group-" + g.id} inert={!!collapsed.value[g.id]}>
                  <div className="doc-reveal-inner">
                    <div className={"doc-grid"}>
                      {g.items.map((s) => (
                        <button
                          key={s.name}
                          onClick={(event) => {
                            props.onRequest?.(s.name);
                          }}
                          className={"doc-tile"}
                          aria-label={s.name}
                        >
                          <span className="doc-icon"><DocumentIcon name={s.name}/></span>
                          <span className="doc-tile-copy"><b>{s.name}</b><small>{documentHint(s)}</small></span>
                          <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className={"forward"}
                          >
                            <path d="m6 3 5 5-5 5" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
            {!catalog.value.length ? (
              <div className="docs-empty"><FileSearch size={30} strokeWidth={1.6}/><h2>Ничего не найдено</h2><p>Попробуйте другое название или выберите услугу в каталоге.</p><button onClick={() => {query.value = "";}}>Показать все услуги</button></div>
            ) : null}
          </div>
        ) : props.view === "directory" ? (
          <PeopleDirectory key={props.peer} initial={props.peer || ""} avatars={props.avatars} onGo={props.onGo} />
        ) : props.view === "person" && peer.value ? (
          <PersonProfile person={peer.value} avatars={props.avatars} lessonChanges={props.lessonChanges} onGo={props.onGo} />
        ) : props.view === "threads" ? (
          <ChatInbox key={props.peer || "inbox"} initialGroup={props.peer} owner={props.owner} messages={props.messages} avatars={props.avatars}
            teachingGroups={props.teachingGroups} busy={props.busy} send={props.send} onGo={props.onGo} />
        ) : props.view === "chat" && peer.value ? (
          <Fragment>
            <section className={"chat-panel"}>
              <button
                onClick={(event) => {
                  props.onGo?.("person", peer.value.id);
                }}
                className={"person-row"}
              >
                <>{props.avatars[peer.value.id] ? <img src={props.avatars[peer.value.id]} alt="" /> : <i>{peer.value.initials}</i>}</>
                <span>
                  <strong>{peer.value.name}</strong>
                  <small>
                    {peer.value.title}
                    {" · "}
                    {peer.value.unit}
                  </small>
                </span>
                <span>{"›"}</span>
              </button>
              <div ref={log} role="log" aria-label={"Переписка с " + peer.value.name} className={"chat-log"}>
                {!dialog.value.length ? (
                  <p>{"Начните диалог с приветствия."}</p>
                ) : null}
                {dialog.value.map((m) => (
                  <article
                    key={m.id}
                    className={classNames({
                      mine: m.sender === props.owner,
                    })}
                  >
                    <p>{m.body}</p>
                    <small>{time(m.created)}</small>
                  </article>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  send(event);
                }}
                className={"hub-form"}
              >
                <label className={"field"}>
                  {"Сообщение"}
                  <textarea
                    value={draft.value ?? ""}
                    onChange={(event) => {
                      draft.value = event.target.value;
                    }}
                    required
                    rows="2"
                    maxLength="4000"
                  />
                </label>
                <button
                  disabled={props.busy || !draft.value.trim()}
                  className={"campus-action"}
                >
                  {" Отправить сообщение "}
                </button>
              </form>
            </section>
          </Fragment>
        ) : props.view === "structure" ? (
          <UniversityStructure path={props.peer || ""} owner={props.owner} avatars={props.avatars} onGo={props.onGo} />
        ) : props.view === "electives" && props.electives ? (
          <Electives
            state={props.electives}
            busy={props.busy}
            onSave={props.send}
            onPlan={() => props.onGo?.("plan", "electives")}
          />
        ) : props.view === "plan" ? (
          <section className="academic-section">
            <div className="term-picker" role="group" aria-label="Семестры">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-label={n + " семестр"}
                  aria-pressed={semester.value === n}
                  onClick={() => (semester.value = n)}
                >
                  {n} сем.
                </button>
              ))}
            </div>
            <div className="plan-semester-card" key={semester.value}>
            <div className="semester-heading">
              <h2>{semester.value} семестр</h2>
              <small>
                {curriculum(program.value)[semester.value - 1].reduce(
                  (sum, d) => sum + d.credits,
                  0,
                )}{" "}
                з. е.
              </small>
            </div>
            <table className="plan-courses">
              <thead>
                <tr>
                  <th>Дисциплина</th>
                  <th>З. е.</th>
                  <th>Контроль</th>
                </tr>
              </thead>
              <tbody>
                {curriculum(program.value)[semester.value - 1].map((d) => (
                  <tr key={d.subject}>
                    <th scope="row">
                      {ownPlan.value &&
                      semester.value === electiveSemester &&
                      d.subject === "Дисциплина по выбору" &&
                      selected.value
                        ? selected.value.name
                        : d.subject}
                    </th>
                    <td>{d.credits}</td>
                    <td>{d.assessment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        ) : props.view === "dorm" ? (
          <HousingView account={props.housing} student={me.value.role === "student"} records={props.records}
            onGo={props.onGo} onRequest={props.onRequest} onRecord={props.onRecord} />
        ) : props.view === "residence" ? (
          <ResidenceDetails id={props.peer} />
        ) : null}
      </div>
    </>
  );
}
