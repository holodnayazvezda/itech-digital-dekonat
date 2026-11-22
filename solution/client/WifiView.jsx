import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, RefreshCw, Check, Clock3, Info, ChevronDown, LoaderCircle } from "lucide-react";

const network = "Campus Study";

function WifiMark() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 7.8a14.3 14.3 0 0 1 18 0M6.5 12a8.8 8.8 0 0 1 11 0M10 16.2a3.3 3.3 0 0 1 4 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="12" cy="20" r="1.45" fill="currentColor" />
  </svg>;
}

export default function WifiView({owner,password,readyAt,readyTime,busy,onReset,onMessage}) {
  const [visible,setVisible]=useState(false);
  const [copied,setCopied]=useState("");
  const [confirm,setConfirm]=useState(false);
  const [now,setNow]=useState(Date.now());
  const login=owner + ".demo";
  const pending=readyAt>now;
  const remaining=Math.max(0,Math.ceil((readyAt-now)/1000));
  const countdown=Math.floor(remaining/60) + ":" + String(remaining%60).padStart(2,"0");
  useEffect(()=>{setVisible(false);setCopied("");},[owner,password]);
  useEffect(()=>{
    setNow(Date.now());
    if(readyAt<=Date.now())return;
    const timer=setInterval(()=>{setNow(Date.now());if(Date.now()>=readyAt)clearInterval(timer);},1000);
    return ()=>clearInterval(timer);
  },[readyAt]);
  useEffect(()=>{
    if(!copied)return;
    const timer=setTimeout(()=>setCopied(""),2000);
    return ()=>clearTimeout(timer);
  },[copied]);
  async function copy(key,value) {
    try { await navigator.clipboard.writeText(value);setCopied(key); }
    catch { onMessage("Не удалось скопировать. Выделите нужный текст и скопируйте вручную."); }
  }
  async function reset() {
    if(busy)return;
    if(await onReset())setConfirm(false);
  }
  function copyButton(field,value,label) {
    return <button className="wifi-icon-button" type="button" onClick={()=>copy(field,value)} disabled={busy || !value} aria-label={copied===field ? label+": скопировано" : label} title={copied===field ? "Скопировано" : label}>{copied===field ? <Check size={17}/> : <Copy size={17} strokeWidth={1.6}/>}</button>;
  }
  return <div className="wifi-page-layout wifi-redesign">
    <section className="wifi-access-card" aria-label="Данные для подключения">
      <div className="wifi-network-heading">
        <span className="wifi-network-icon"><WifiMark/></span>
        <div><span className="wifi-network-eyebrow">Учебная сеть</span><h2>{network}</h2></div>
        {copyButton("network",network,"Скопировать название сети")}
      </div>
      <div className={`wifi-status ${pending ? "wifi-status-pending" : ""}`} role="status">{pending ? <Clock3 size={14}/> : password ? <Check size={14}/> : <Info size={14}/>}<span>{pending ? "Новый пароль активируется" : password ? "Реквизиты готовы" : "Реквизиты недоступны"}</span></div>
      <div className="wifi-credentials">
        <div className="wifi-credential-row"><label htmlFor="campus-wifi-login">Логин</label><div className="wifi-credential-control"><input id="campus-wifi-login" autoComplete="off" readOnly spellCheck={false} value={login}/>{copyButton("login",login,"Скопировать логин")}</div></div>
        <div className="wifi-credential-row"><label htmlFor="campus-wifi-password">Пароль сети</label><div className="wifi-credential-control"><input id="campus-wifi-password" autoComplete="off" readOnly spellCheck={false} type={visible ? "text":"password"} value={password || ""} placeholder="Пока недоступен"/>
          <button className="wifi-icon-button" type="button" disabled={!password} aria-label={visible ? "Скрыть пароль":"Показать пароль"} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff size={18} strokeWidth={1.6}/> : <Eye size={18} strokeWidth={1.6}/>}</button>
          {copyButton("password",password,"Скопировать пароль")}
        </div></div>
      </div>
      <div className="wifi-copy-feedback" aria-live="polite">{copied ? ({network:"Название сети скопировано",login:"Логин скопирован",password:"Пароль скопирован"})[copied] : "Пароль сети отличается от пароля входа в кабинет"}</div>
      {pending && <section className="wifi-activation-card" aria-label="Активация пароля">
        <div className="wifi-activation-copy"><h3><Clock3 size={14} strokeWidth={1.5}/>Активация нового пароля</h3><p>Будет готов примерно в <time>{readyTime}</time> МСК</p><span className="wifi-activation-hint">Обычно до 5 минут</span></div>
        <span className="wifi-countdown" aria-label={"Осталось примерно " + countdown}>{countdown}</span>
        <div className="wifi-activation-track" aria-hidden="true"><span style={{width:Math.max(0,Math.min(100,(1-(readyAt-now)/300000)*100))+"%"}}/></div>
      </section>}
      <div className="wifi-reset-area">
        {!confirm ? <button className="wifi-reset-link" onClick={()=>setConfirm(true)} disabled={busy || !password}><RefreshCw size={16} strokeWidth={1.7}/>Сменить пароль</button> : <div className="wifi-reset-confirm"><h3>Создать новый пароль?</h3><p>Текущий пароль будет заменён. Новый начнёт работать примерно через 5 минут.</p><div><button className="wifi-confirm-button" onClick={reset} disabled={busy}>{busy && <LoaderCircle size={15} className="wifi-spin"/>}{busy ? "Создаём…" : "Создать пароль"}</button><button className="wifi-cancel-button" onClick={()=>setConfirm(false)} disabled={busy}>Отмена</button></div></div>}
      </div>
    </section>
    <aside className="wifi-guide" aria-label="Помощь с подключением">
      <h2>Как подключиться</h2>
      <ol className="wifi-steps">
        <li><span>1</span><div><h3>Откройте Wi-Fi на устройстве</h3><p>В настройках телефона или компьютера.</p></div></li>
        <li><span>2</span><div><h3>Выберите {network}</h3><p>Найдите учебную сеть в списке доступных.</p></div></li>
        <li><span>3</span><div><h3>Введите данные из карточки</h3><p>Скопируйте логин и пароль сети. Пароль от кабинета здесь не подойдёт.</p></div></li>
      </ol>
      <details className="wifi-help"><summary>Не получается подключиться?<ChevronDown size={16}/></summary><p>Если вы только что сменили пароль, дождитесь времени активации. Затем удалите сохранённую сеть на устройстве и подключитесь заново с новыми данными.</p></details>
      <p className="wifi-demo-note"><Info size={14}/><span>Демонстрационный доступ. Подключение к реальной сети университета не выполняется.</span></p>
    </aside>
  </div>;
}
