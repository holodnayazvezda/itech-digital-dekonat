import { useLayoutEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { electiveOptions, electiveSemester } from "../shared/electives.js";

const longDate = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(value + "T12:00:00+03:00"));

export default function Electives({ state, busy, onSave, onPlan }) {
  const [draft, setDraft] = useState(state.selected);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const previewTrigger = useRef(null);
  const previewClose = useRef(null);
  const restorePreviewFocus = useRef(false);
  const selected = electiveOptions.find((o) => o.id === state.selected);
  const open = state.phase === "open";
  const demoOpen = !open && state.juryAvailable && preview;
  useLayoutEffect(() => {
    if (!restorePreviewFocus.current) return;
    restorePreviewFocus.current = false;
    (demoOpen ? previewClose : previewTrigger).current?.focus();
  }, [demoOpen]);
  function togglePreview() {
    restorePreviewFocus.current = true;
    setPreview(!preview);
  }
  async function submit(event) {
    event.preventDefault();
    if (saving || busy || !(open || demoOpen) || !draft || draft === state.selected) return;
    setSaving(true);
    try {
      await onSave("choose-elective", {
        course: draft,
        previous: state.selected,
        juryPreview: demoOpen,
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="academic-section">
      {open || demoOpen ? <div className="choice-window">
        <p className="academic-caption">{electiveSemester} семестр · 5 з. е.</p>
        <h2>{demoOpen ? "Демонстрация выбора" : "Выбор открыт"}</h2>
        <p>Период записи — с {longDate(state.opens)} по {longDate(state.closes)} включительно.</p>
        {demoOpen && <button ref={previewClose} type="button" className="text-link" onClick={togglePreview}>Закрыть демонстрацию</button>}
      </div> : <div className="elective-locked" role="status">
        <LockKeyhole size={22} strokeWidth={1.7} aria-hidden="true"/>
        <p>{state.phase === "upcoming"
          ? "Выбор дисциплин откроется " + longDate(state.opens)
          : "Выбор дисциплин завершён"}</p>
      </div>}
      {selected && (
        <div className="chosen-course" role="status">
          <span>В вашем учебном плане</span>
          <strong>{selected.name}</strong>
          <button className="text-link" onClick={onPlan}>
            Открыть 4 семестр ↗
          </button>
        </div>
      )}
      {!open && !demoOpen && state.juryAvailable && <button ref={previewTrigger} type="button" className="campus-action" onClick={togglePreview}>Показать выбор для жюри</button>}
      {(open || demoOpen) && (
        <form className="elective-form" onSubmit={submit}>
          <fieldset>
            <legend>Доступные дисциплины</legend>
            {electiveOptions.map((o) => (
              <label key={o.id} className="elective-option">
                <input
                  type="radio"
                  name="course"
                  value={o.id}
                  checked={draft === o.id}
                  disabled={
                    saving ||
                    busy ||
                    (!state.remaining[o.id] && state.selected !== o.id)
                  }
                  onChange={() => setDraft(o.id)}
                />
                <span>
                  <strong>{o.name}</strong>
                  <small>{o.description}</small>
                  <small>{o.teacher}</small>
                </span>
                <b>
                  {state.selected === o.id
                    ? "В вашем плане"
                    : state.remaining[o.id]
                      ? "Мест: " + state.remaining[o.id]
                      : "Мест нет"}
                </b>
              </label>
            ))}
          </fieldset>
          <button
            className="campus-action"
            disabled={
              saving ||
              busy ||
              !draft ||
              draft === state.selected ||
              !state.remaining[draft]
            }
          >
            {saving
              ? "Сохранение…"
              : selected
                ? "Изменить выбор"
                : "Сохранить выбор"}
          </button>
        </form>
      )}
    </section>
  );
}
