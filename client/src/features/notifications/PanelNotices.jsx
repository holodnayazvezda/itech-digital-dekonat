import { people } from "../../shared/domain/campus-data.js";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelNotices() {
  useSignals();
  const {
    busy,
    perform,
    openNote,
    noticeHint,
    connectingPush,
    enablePush,
    pushMode,
    notes
  } = useCabinet();
  return <Fragment>
                    {pushMode.value !== "off" && window.Notification?.permission === "granted" && <p role="status" className="notification-status">
                        {pushMode.value === "background" ? "Уведомления браузера включены." : "Уведомления приходят, пока кабинет открыт."}
                      </p>}
                    {noticeHint ? <p className="notification-status">{noticeHint}</p> : window.Notification?.permission === "denied" ? <p className="notification-status">Браузер блокирует уведомления. Разрешите их в настройках этого сайта — кабинет подключится автоматически.</p> : (pushMode.value !== "background" || window.Notification?.permission !== "granted") && <button disabled={connectingPush.value} onClick={enablePush} className="text-link">
                        {connectingPush.value ? "Подключение…" : pushMode.value === "foreground" ? "Подключить фоновую доставку" : "Включить уведомления браузера"}
                      </button>}
                    {!notes.value.length && <p role="status">Уведомлений пока нет.</p>}
                    {notes.value.map(n => <button key={n.id} onClick={event => {
      openNote(n);
    }} className="notice-row" data-unread={!n.read}>
                        <small>
                          {!n.read && "Новое · "}
                          {new Date(n.created).toLocaleDateString("ru-RU")}
                          {" · "}
                          {n.ref?.startsWith("chat:") && people[n.ref.slice(5)] ? "Личные сообщения" : n.ref?.startsWith("lesson:") ? "Расписание" : "Деканат"}
                        </small>
                        <b>{n.title}</b>
                      </button>)}
                    {notes.value.length > 0 && <button className="text-link clear-notices" disabled={busy.value} onClick={() => perform("notes/clear", {
      through_id: notes.value[0].id
    })}>
                        Очистить уведомления
                      </button>}
                  </Fragment>;
}
