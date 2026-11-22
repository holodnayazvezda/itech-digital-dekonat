import { useMemo, useRef, useState } from "react";
import { directoryPeople as people } from "../shared/university.js";
import { newRequestId } from "./request-id.js";
import "./chat.css";

const stamp = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

function recentThreads(messages, owner) {
  const seen = new Set();
  const threads = [];
  for (let index = messages.length - 1; index >= 0; index--) {
    const last = messages[index];
    const id = last.sender === owner ? last.recipient : last.sender;
    if (seen.has(id) || !people[id]) continue;
    seen.add(id);
    threads.push({ person: people[id], last });
  }
  return threads;
}

function words(text) {
  return text.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

export default function ChatInbox({owner, messages, avatars, teachingGroups = [], initialGroup, busy, send, onGo}) {
  const preset = teachingGroups.find(g => g.group === initialGroup)?.group || "";
  const [mode, setMode] = useState(preset ? "group" : "inbox");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [group, selectGroup] = useState(preset);
  const [draft, setDraft] = useState("");
  const [receipt, setReceipt] = useState("");
  const attempt = useRef(null);
  const threads = useMemo(() => recentThreads(messages, owner), [messages, owner]);
  const search = words(query);
  const matches = p => words([p.name, p.number, p.unit].join(" ")).includes(search);
  const contacts = useMemo(() => mode === "new"
    ? Object.values(people).filter(p => p.id !== owner && matches(p)) : [],
    [mode, owner, search]);
  const visible = threads.filter(({person, last}) => matches(person) || (search && words(last.body).includes(search)));
  const selected = teachingGroups.find(g => g.group === group);

  function changeMode(next) {
    setQuery("");
    setLimit(25);
    setReceipt("");
    setMode(next);
  }
  async function broadcast(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!selected?.recipients || !body || busy) return;
    if (attempt.current?.group !== group || attempt.current?.body !== body) {
      attempt.current = {group, body, requestId: newRequestId()};
    }
    const result = await send("group-message", attempt.current);
    if (!result) return;
    setReceipt("Сообщение отправлено группе " + result.group + ". Получателей — " + result.recipients + ".");
    setDraft("");
    setMode("inbox");
    attempt.current = null;
  }
  const personRow = (person, last) => (
    <button key={person.id} type="button" className="thread-row" onClick={() => onGo("chat", person.id)}>
      {avatars[person.id] ? <img className="thread-avatar" src={avatars[person.id]} alt="" /> :
        <i className="thread-avatar" aria-hidden="true">{person.initials}</i>}
      <span className="thread-copy">
        <strong>{person.name}</strong>
        <small>{last ? (last.sender === owner ? "Вы: " : "") + last.body : person.caption}</small>
      </span>
      {last && <time dateTime={new Date(last.created).toISOString()}>{stamp.format(last.created)}</time>}
    </button>
  );

  return (
    <section className="chat-inbox">
      <div className="inbox-actions">
        <button type="button" className="campus-action" aria-pressed={mode === "new"}
          onClick={() => changeMode(mode === "new" ? "inbox" : "new")}>Новый диалог</button>
        {people[owner]?.role === "teacher" && (
          <button type="button" className="inbox-secondary" aria-pressed={mode === "group"}
            onClick={() => changeMode(mode === "group" ? "inbox" : "group")}>Рассылка группе</button>
        )}
      </div>
      {receipt && <p role="status" className="inbox-receipt">{receipt}</p>}
      {mode === "group" ? (
        <form className="mass-message hub-form" onSubmit={broadcast}>
          <h2>Сообщение группе</h2>
          {teachingGroups.length ? <>
            <label className="field">Учебная группа
              <select required value={group} onChange={e => selectGroup(e.target.value)} disabled={busy}>
                <option value="">Выберите группу</option>
                {teachingGroups.map(g => <option key={g.group} value={g.group}>{g.group} · студентов {g.recipients}</option>)}
              </select>
            </label>
            <label className="field">Текст рассылки
              <textarea rows={4} required maxLength={4000} disabled={busy} value={draft}
                onChange={e => setDraft(e.target.value)} />
            </label>
            <p>Каждый студент получит сообщение в личном диалоге и сможет ответить вам.</p>
            <button className="campus-action" disabled={busy || !selected?.recipients || !draft.trim()}>
              {busy ? "Отправка…" : selected ? "Отправить группе " + group : "Отправить группе"}
            </button>
          </> : <p>У вас пока нет закреплённых учебных групп.</p>}
          <button type="button" className="text-link" onClick={() => changeMode("inbox")}>Назад к диалогам</button>
        </form>
      ) : <>
        <h2>{mode === "new" ? "Выберите собеседника" : "Мои диалоги"}</h2>
        {(mode === "new" || threads.length > 0) && <label className="hub-search">
          <input aria-label={mode === "new" ? "Найти собеседника" : "Поиск по диалогам"} type="search" value={query}
            placeholder={mode === "new" ? "ФИО, группа или табельный номер" : "Собеседник или последнее сообщение"}
            onChange={e => {setQuery(e.target.value); setLimit(25);}} />
        </label>}
        <div className="thread-list">
          {mode === "new" ? contacts.slice(0, limit).map(p => personRow(p)) : visible.map(t => personRow(t.person, t.last))}
        </div>
        {mode === "new" && contacts.length > limit && (
          <button type="button" className="text-link" onClick={() => setLimit(limit + 25)}>Показать ещё</button>
        )}
        {mode === "new" && !contacts.length && <p>Участники не найдены.</p>}
        {mode === "inbox" && !visible.length && <p>{threads.length ? "Диалоги не найдены." : "Здесь появятся ваши переписки. Начните новый диалог, чтобы написать участнику университета."}</p>}
      </>}
    </section>
  );
}
