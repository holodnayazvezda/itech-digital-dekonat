import { useEffect, useId, useState } from "react";
import { ArrowUpRight, CheckCircle2, Circle, ClipboardList, Plus } from "lucide-react";
import { printDate } from "../shared/timetable.js";
import PortalLoading from "./PortalLoading.jsx";
import "./office-todo.css";

const emptyDraft = { title: "", body: "", due: "", request_id: "" };
const endpoint = "office/tasks";
const taskOrder = (first, second) =>
  (first.due || "9999-12-31").localeCompare(second.due || "9999-12-31") || second.created - first.created;
const inProgress = record => ["pending", "clarification"].includes(record.status);

export default function OfficeTodo({ request, records, onRecord }) {
  const requestLabel = useId();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [loadAttempt, retry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const open = tasks.filter(task => !task.complete);
  const complete = tasks.filter(task => task.complete);
  const linked = new Map(records.map(record => [record.id, record]));
  const requestOptions = [...records].sort((first, second) => Number(inProgress(second)) - Number(inProgress(first)));
  const visible = (showComplete ? complete : open).sort(taskOrder);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(endpoint, undefined, { signal: controller.signal }).then(
      result => {
        if (controller.signal.aborted) return;
        setTasks(result);
        setLoaded(true);
        setLoading(false);
      },
      problem => {
        if (controller.signal.aborted) return;
        setError(problem.message);
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [request, loadAttempt]);

  function updateDraft(event) {
    const { name, value } = event.target;
    setDraft(previous => ({ ...previous, [name]: value }));
  }

  async function create(event) {
    event.preventDefault();
    if (!draft.title.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      const task = await request(endpoint, {
        title: draft.title,
        body: draft.body,
        due: draft.due || null,
        request_id: draft.request_id || null,
      });
      setTasks(previous => [task, ...previous]);
      setShowComplete(false);
      setShowForm(false);
      setDraft(emptyDraft);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setWorking(false);
    }
  }

  async function toggle(task) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const updated = await request(`${endpoint}/${task.id}/status`, { complete: !task.complete });
      setTasks(previous => previous.map(item => item.id === updated.id ? updated : item));
    } catch (problem) {
      setError(problem.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="office-todo" aria-labelledby="office-todo-title">
      <div className="office-todo-heading">
        <h2 id="office-todo-title" tabIndex={-1}><ClipboardList size={20} aria-hidden="true" /> Задачи деканата</h2>
        <button className="office-todo-add" type="button" disabled={!loaded} aria-expanded={showForm} onClick={() => setShowForm(!showForm)}>
          <Plus size={16} aria-hidden="true" /> Новая задача
        </button>
      </div>
      {error && <p className="office-todo-error" role="alert">{error} {!loaded && <button type="button" onClick={() => retry(attempt => attempt + 1)}>Повторить</button>}</p>}
      {showForm && (
        <form className="office-todo-form" onSubmit={create}>
          <label className="field">Название<input name="title" maxLength={140} required value={draft.title} onChange={updateDraft} /></label>
          <label className="field">Срок<input type="date" name="due" value={draft.due} onChange={updateDraft} /></label>
          <label className="field"><span id={requestLabel}>Связанная заявка</span><select name="request_id" aria-labelledby={requestLabel} value={draft.request_id} onChange={updateDraft}>
            <option value="">Без заявки</option>
            {requestOptions.map(record => <option key={record.id} value={record.id}>{record.name} · {record.id}</option>)}
          </select></label>
          <label className="field office-todo-description">Заметка<textarea name="body" maxLength={1000} rows={2} value={draft.body} onChange={updateDraft} /></label>
          <button className="office-todo-add" disabled={working || !draft.title.trim()}>Добавить</button>
        </form>
      )}
      {loading ? <PortalLoading layout="tasks" /> : loaded && <>
        <div className="office-todo-tabs" role="group" aria-label="Статус задач">
          <button type="button" aria-pressed={!showComplete} onClick={() => setShowComplete(false)}>В работе <span>{open.length}</span></button>
          <button type="button" aria-pressed={showComplete} onClick={() => setShowComplete(true)}>Готово <span>{complete.length}</span></button>
        </div>
        {visible.length ? <ul className="office-todo-list">{visible.map(task => {
          const record = linked.get(task.request_id);
          return <li key={task.id}>
            <button type="button" className="office-todo-toggle" disabled={working} onClick={() => toggle(task)}
              aria-label={(task.complete ? "Вернуть в работу: " : "Завершить: ") + task.title}>
              {task.complete ? <CheckCircle2 size={21} aria-hidden="true" /> : <Circle size={21} aria-hidden="true" />}
            </button>
            <div><strong>{task.title}</strong>{task.body && <p>{task.body}</p>}
              {task.due && <small>Срок {printDate(task.due, { day: "numeric", month: "long", year: "numeric" })}</small>}
            </div>
            {record && <button type="button" className="office-todo-link" onClick={() => onRecord(record)} aria-label={"Открыть заявку: " + record.name}>
              Заявка <ArrowUpRight size={14} aria-hidden="true" />
            </button>}
          </li>;
        })}</ul> : <p className="office-todo-empty">{showComplete ? "Выполненных задач пока нет." : "Открытых задач пока нет."}</p>}
      </>}
    </section>
  );
}
