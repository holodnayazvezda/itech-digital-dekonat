import { useRef, useState } from "react";
import { readRequestAttachment } from "./request-attachment.js";

export default function RequestCorrection({ busy, onSend, attachedFile }) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const readVersion = useRef(0);

  async function attach(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    const version = ++readVersion.current;
    setError("");
    setAttachment(null);
    setReading(Boolean(file));
    if (!file) return;
    try {
      const upload = await readRequestAttachment(file);
      if (version === readVersion.current) setAttachment(upload);
    } catch (problem) {
      if (version !== readVersion.current) return;
      setError(problem.message);
      input.value = "";
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  }

  return (
    <form className="hub-form" onSubmit={event => {
      event.preventDefault();
      if (!busy && !reading && body.trim()) onSend(body, attachment);
    }}>
      <label className="field">
        Дополнительные сведения
        <textarea required maxLength={2500} rows={3} value={body} onChange={event => setBody(event.target.value)} />
      </label>
      <label className="field">
        {attachedFile ? "Заменить вложение" : "Приложить файл"}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={attach} disabled={busy} />
        <small>PDF, PNG или JPEG до 2 МБ</small>
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="campus-action" disabled={busy || reading || !body.trim()}>Дополнить заявку</button>
    </form>
  );
}
