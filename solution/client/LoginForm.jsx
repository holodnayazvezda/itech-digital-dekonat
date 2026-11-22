import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import AccountSelect from "./AccountSelect.jsx";
import demo from "../shared/demo-access.json";

export default function LoginForm({ people, busy, onLogin }) {
  const demonstration = import.meta.env.VITE_CAMPUS_AUTH !== "password";
  const [identity, setIdentity] = useState(demonstration ? "student" : "");
  const [password, setPassword] = useState(demonstration ? demo.password : "");
  const [selected, setSelected] = useState("student");
  const [visible, setVisible] = useState(false);

  function choose(id) {
    setSelected(id);
    setIdentity(id);
    setPassword(demo.password);
    setVisible(false);
  }

  return <form className="login-form" onSubmit={event => {
    event.preventDefault();
    onLogin(identity.trim(), password);
  }}>
    <label className="field">Логин
      <input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        required value={identity} onChange={event => setIdentity(event.target.value)} />
    </label>
    <label className="field">Пароль
      <span className="login-password">
        <input name="password" type={visible ? "text" : "password"} autoComplete="current-password"
          required value={password} onChange={event => setPassword(event.target.value)} />
        <button type="button" className="login-eye" aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={visible} onClick={() => setVisible(value => !value)}>
          {visible ? <EyeOff size={20} strokeWidth={1.6} /> : <Eye size={20} strokeWidth={1.6} />}
        </button>
      </span>
    </label>
    <button disabled={busy} className="campus-action" type="submit">{busy ? "Входим…" : "Войти"}</button>
    {demonstration && <div className="login-demo">
      <p><LockKeyhole size={16} strokeWidth={1.6} aria-hidden="true" />Доступ для жюри</p>
      <AccountSelect showDescription label="Демонстрационный пользователь" value={selected}
        options={demo.accounts.map(account => ({
          value: account.id, label: people[account.id].name, description: account.role,
        }))} onChange={choose} />
      <small>Выберите пользователя — логин и пароль заполнятся автоматически.</small>
    </div>}
  </form>;
}
