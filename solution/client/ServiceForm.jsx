import { moveIn, currentMoveIn, moveInStatus } from "../shared/residences.js";
import { services, choices, submittedFields } from "../shared/services.js";
import { transferRequirements } from "../shared/university.js";
import { computed, useSignal } from "@preact/signals-react";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { readRequestAttachment } from "./request-attachment.js";
export default function ServiceForm(props) {
  useSignals();

  const service = services.find((s) => s.name === props.name);
  const values = useSignal({
    ...(service.group === "housing" && service.name !== moveIn && props.housing
      ? { residence: props.housing.building, room: props.housing.room || "" } : {}),
    group: props.person.unit,
    email: props.person.id + "@campus.example",
  });
  const attachment = useSignal(null),
    reading = useSignal(false);
  async function attach(e) {
    const file = e.target.files[0];
    attachment.value = null;
    error.value = "";
    if (!file) return;
    reading.value = true;
    try {
      attachment.value = await readRequestAttachment(file);
    } catch (problem) {
      error.value = problem.message;
      e.target.value = "";
    } finally {
      reading.value = false;
    }
  }
  const format = useSignal("Электронная"),
    comment = useSignal(""),
    error = useSignal("");
  const requirements = computed(() =>
    transferRequirements(values.value.program, props.person),
  );
  function submit() {
    if (reading.value || props.busy) return;
    try {
      submittedFields(service, values.value, props.person);
      error.value = "";
      props.onSubmit?.({
        kind: "document",
        name: service.name,
        format: format.value,
        values: { ...values.value },
        comment: comment.value,
        attachment: attachment.value,
      });
    } catch (e) {
      error.value = e.message;
    }
  }

  if (service.name === moveIn) {
    if (props.housing) return <p>Вам уже предоставлено место в общежитии. Данные доступны в разделе «Общежития».</p>;
    const pending = currentMoveIn(props.records);
    if (pending) return <><p>{moveInStatus(pending)}</p><button className="campus-action" onClick={() => props.onRecord(pending)}>Открыть заявку</button></>;
  }
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(event);
        }}
        className={"hub-form"}
      >
        <p className={"form-applicant"}>
          <strong>{props.person.name}</strong>
          <br />
          {props.person.program}
          {" · "}
          {props.person.unit}
        </p>
        {service.certificate ? (
          <label className={"field"}>
            {"Формат"}
            <select
              value={format.value ?? ""}
              onChange={(event) => {
                format.value = event.target.value;
              }}
            >
              <option>{"Электронная"}</option>
              <option>{"Бумажная"}</option>
            </select>
          </label>
        ) : null}
        {service.fields.map((f) => (
          <Fragment key={f.id}>
            <label className={"field"}>
              {f.label}{" "}
              {choices(f, props.person) ? (
                <select
                  value={values.value[f.id] ?? ""}
                  onChange={(event) => {
                    values.value = {
                      ...values.value,
                      [f.id]: event.target.value,
                    };
                  }}
                  required
                >
                  <option disabled value="">
                    {"Выберите из списка"}
                  </option>
                  {choices(f, props.person).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={values.value[f.id] ?? ""}
                  onChange={(event) => {
                    values.value = {
                      ...values.value,
                      [f.id]: event.target.value,
                    };
                  }}
                  required
                  maxLength="2000"
                  rows="3"
                />
              ) : (
                <input
                  type={f.type}
                  value={values.value[f.id] ?? ""}
                  onChange={(event) => {
                    values.value = {
                      ...values.value,
                      [f.id]: event.target.value,
                    };
                  }}
                  required
                  maxLength="200"
                  min={f.id === "end" ? values.value.start : undefined}
                />
              )}
            </label>
            {f.type === "program" && requirements.value.length ? (
              <section className={"transfer-box"}>
                <h3>{"Академическая разница"}</h3>
                {requirements.value.map((r) => (
                  <div key={r.subject}>
                    <span>{r.subject}</span>
                    <b>{r.met ? "Зачтено" : "Пройти аттестацию"}</b>
                  </div>
                ))}
                <p>
                  {
                    " По правилам демонстрационной программы минимум по недостающим дисциплинам — 60 из 100 баллов. После аттестации комиссия проводит собеседование. Решение появится в заявке. "
                  }
                </p>
              </section>
            ) : null}
          </Fragment>
        ))}
        {!service.certificate ? (
          <label className={"field"}>
            {"Подтверждающий документ (по желанию)"}
            <input
              type="file"
              disabled={reading.value}
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={attach}
            />
            <small>{"PDF, PNG или JPEG, до 2 МБ"}</small>
          </label>
        ) : null}
        <label className={"field"}>
          {"Комментарий (по желанию)"}
          <textarea
            value={comment.value ?? ""}
            onChange={(event) => {
              comment.value = event.target.value;
            }}
            rows="2"
            maxLength="2500"
          />
        </label>
        {error.value ? <p role="alert">{error.value}</p> : null}
        <button
          disabled={props.busy || reading.value}
          className={"campus-action"}
        >
          {" Отправить заявку "}
        </button>
      </form>
    </>
  );
}
