import { useRef, useState } from "react";
import { Camera, UsersRound, LogOut, ChevronDown, ArrowRight } from "lucide-react";
import AccountSelect from "../../shared/ui/AccountSelect.jsx";
export default function ProfilePanel({
  account,
  avatar,
  owner,
  identities,
  people,
  allowSwitch,
  busy,
  onAvatar,
  onSwitch,
  onLogout
}) {
  const photo = useRef(null);
  const [switching, setSwitching] = useState(false);
  const [selected, setSelected] = useState(owner);
  const facts = account.role === "student" ? [["Направление", account.program], ["Факультет", account.faculty], ["Курс", account.course], ["Группа", account.unit]] : [["Должность", account.title], ["Подразделение", account.faculty || account.unit]];
  return <div className="profile-content">
    <section className="profile-identity" aria-label="Личные данные">
      <div className="profile-avatar">{avatar ? <img src={avatar} alt="Фото профиля" /> : <span>{account.initials}</span>}</div>
      <div className="profile-name"><h3>{account.name}</h3><p>{account.role === "student" ? "Студент" : account.title}</p><button onClick={() => photo.current?.click()} disabled={busy} className="profile-photo-action"><Camera size={15} strokeWidth={1.6} />Изменить фото</button></div>
      <input ref={photo} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Загрузить фото профиля" onChange={onAvatar} />
    </section>
    <section className="profile-details" aria-label={account.role === "student" ? "Учёба" : "Работа"}>
      <h3>{account.role === "student" ? "Учёба" : "Работа"}</h3>
      <dl>{facts.filter(([, value]) => value !== undefined && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <div className="profile-account-actions">
      {allowSwitch && <>
        <button className="profile-switch-toggle" onClick={() => setSwitching(!switching)} aria-expanded={switching} aria-controls={switching ? "profile-switcher" : undefined}><UsersRound size={19} strokeWidth={1.6} /><span>Сменить пользователя</span><ChevronDown size={17} className={switching ? "expanded" : ""} /></button>
        {switching && <div id="profile-switcher" className="profile-switcher">
          <AccountSelect label="Пользователь" value={selected} options={Object.values(identities).flat().map(id => ({
            value: id,
            label: people[id].name,
            description: people[id].caption
          }))} onChange={setSelected} />
          <button className="profile-switch-confirm" disabled={busy || selected === owner} onClick={() => onSwitch(selected)}>Перейти в кабинет<ArrowRight size={16} /></button>
        </div>}
      </>}
      <button className="profile-logout" onClick={onLogout} disabled={busy}><LogOut size={19} strokeWidth={1.6} /><span>Выйти</span></button>
    </div>
  </div>;
}
