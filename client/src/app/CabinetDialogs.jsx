import RequestCorrection from "../features/documents/RequestCorrection.jsx";
import { mdiClose, mdiArrowLeft } from "@mdi/js";
import { PortalSection } from "../shared/ui/PortalLoading.jsx";
import RequestSummary from "../features/documents/RequestSummary.jsx";
import LetterRecipient from "../features/communication/LetterRecipient.jsx";
import { people } from "../shared/domain/campus-data.js";
import { Fragment, lazy } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Icon, Dialog } from "../shared/ui/ui.jsx";
const RoomFinder = lazy(() => import("../features/booking/RoomFinder.jsx"));
import { useCabinet } from "../shared/state/CabinetContext.jsx";
import PanelNotices from '../features/notifications/PanelNotices.jsx';
import PanelLesson from '../features/schedule/PanelLesson.jsx';
import PanelTeacher from '../features/schedule/PanelTeacher.jsx';
import PanelRoom from '../features/booking/PanelRoom.jsx';
import PanelBooked from '../features/documents/PanelBooked.jsx';
import PanelRequest from '../features/documents/PanelRequest.jsx';
import PanelFinance from '../features/finance/PanelFinance.jsx';
import PanelWifi from '../features/wifi/PanelWifi.jsx';
import PanelProfile from '../features/profile/PanelProfile.jsx';
export default function CabinetDialogs() {
  useSignals();
  const {
    role,
    route,
    open,
    schedule,
    goPage,
    showEvent,
    page,
    financeName,
    reservations,
    lessonChanges,
    owner,
    busy,
    submitRequest,
    records,
    openRecord,
    perform,
    openNote,
    filter,
    panel,
    showDialog,
    close,
    stack,
    back,
    docName,
    titles,
    lesson,
    roomInitial,
    activeRecord,
    noticeHint,
    connectingPush,
    enablePush,
    download,
    caseReply,
    reason,
    decide,
    pushMode,
    notes,
    activeNote,
    sendLetter,
    letterTo,
    letterSubject,
    letterBody
  } = useCabinet();
  return <Dialog className={["notices", "letter"].includes(panel.value) ? "notices-dialog" : panel.value === "lesson" ? "lesson-dialog" : panel.value === "profile" ? "profile-dialog" : panel.value === "record" ? "request-dialog" : ""} label={panel.value === "notices" ? "Уведомления" : panel.value === "letter" ? "Уведомление" : panel.value === "profile" ? "Профиль" : panel.value === "record" ? "Заявка" : "Карточка кабинета"} focusSelf={["profile", "record", "lesson", "notices", "letter"].includes(panel.value)} open={showDialog.value} onClose={close} maxWidth={["lesson", "notices", "letter"].includes(panel.value) ? "100vw" : panel.value === "spaces" ? 1140 : panel.value === "finance" ? 790 : panel.value === "teacher" ? 600 : 480}>
          <div className="sheet">
            <div className={"sheet-top"}>
              {stack.value.length ? <button onClick={back} aria-label="Назад" className={"circle"}>
                  <Icon icon={mdiArrowLeft} />
                </button> : null}
              {panel.value === "notices" ? <h2>Уведомления</h2> : panel.value === "letter" ? <h2>Уведомление</h2> : panel.value === "profile" ? <h2>Профиль</h2> : panel.value === "record" ? <h2>Заявка</h2> : <small>{panel.value === "lesson" ? "Занятие" : "Цифровой деканат"}</small>}
              <button onClick={close} aria-label="Закрыть" className={"circle close"}>
                <Icon icon={mdiClose} />
              </button>
            </div>
            <Fragment>
              <article key={panel.value}>
                <h2 hidden={["profile", "record", "lesson", "notices", "letter"].includes(panel.value)}>
                  {panel.value === "finance" ? financeName.value : panel.value === "record" && role.value === "office" ? "Обращение" : panel.value === "request" ? docName.value : titles[panel.value]}
                </h2>
                {panel.value === "lesson" ? <PanelLesson /> : null}
                {panel.value === "teacher" ? <PanelTeacher /> : null}
                {panel.value === "room" ? <PanelRoom /> : null}
                {["spaces", "sports"].includes(panel.value) ? <PortalSection layout={panel.value === "sports" ? "sports" : "booking"}>
                    <RoomFinder key={panel.value} sportsOnly={panel.value === "sports"} schedule={schedule.value} initial={roomInitial.value} reservations={reservations.value} lessonChanges={lessonChanges.value} role={role.value} owner={owner.value} busy={busy.value} onSend={submitRequest} />
                  </PortalSection> : null}
                {panel.value === "booked" ? <PanelBooked /> : null}
                {panel.value === "request" ? <PanelRequest /> : null}
                {panel.value === "record" && activeRecord.value ? <Fragment>
                    <RequestSummary record={activeRecord.value} />
                    {activeRecord.value.status === "pending" && activeRecord.value.owner === owner.value ? <Fragment>
                        <p>Решение деканата придёт в уведомления.</p>
                        {!noticeHint && window.Notification?.permission === "default" && <button disabled={connectingPush.value} onClick={enablePush} className="text-link">
                            {connectingPush.value ? "Подключение…" : "Включить уведомления браузера"}
                          </button>}
                      </Fragment> : null}
                    {activeRecord.value.reason ? <p>{activeRecord.value.reason}</p> : null}
                    {activeRecord.value.details ? <dl className={"ledger"}>
                        {Object.entries(activeRecord.value.details || {}).map(([k, v]) => <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>)}
                      </dl> : null}
                    {activeRecord.value.requirements?.map(r => <p key={r.subject}>
                        {r.subject}
                        {" · "}
                        {r.met ? "Зачтено" : "Пройти аттестацию"}
                      </p>)}
                    {activeRecord.value.attachment ? <button onClick={event => {
              download(activeRecord.value, true);
            }} className={"text-link"}>
                        {" Скачать вложение · "}
                        {activeRecord.value.attachment}
                      </button> : null}
                    {activeRecord.value.discussion?.length ? <section className={"case-discussion"}>
                        <h3>{"Уточнения по заявке"}</h3>
                        {activeRecord.value.discussion.map(m => <article key={m.created + "-" + m.sender}>
                            <small>{people[m.sender].name}</small>
                            <p>{m.body}</p>
                          </article>)}
                      </section> : null}
                    {activeRecord.value.status === "clarification" && owner.value === activeRecord.value.owner ? <RequestCorrection key={activeRecord.value.id} busy={busy.value} attachedFile={activeRecord.value.attachment} onSend={(body, attachment) => caseReply("supplement", body, attachment)} /> : null}
                    {activeRecord.value.comment ? <p>{activeRecord.value.comment}</p> : null}
                    {role.value === "office" && activeRecord.value.status === "pending" ? <Fragment>
                        <label className={"field"}>
                          {"Комментарий к решению"}
                          <textarea value={reason.value ?? ""} onChange={event => {
                  reason.value = event.target.value;
                }} rows="2" />
                        </label>
                        {activeRecord.value.kind === "document" ? <button disabled={busy.value || !reason.value.trim()} onClick={event => {
                caseReply("clarify");
              }} className={"text-link"}>
                            {" Вернуть на доработку "}
                          </button> : null}
                        <div className={"action-row"}>
                          <button disabled={busy.value} onClick={event => {
                  decide("approved");
                }} className={"campus-action"}>
                            {" Одобрить"}
                          </button>
                          <button disabled={busy.value} onClick={event => {
                  decide("rejected");
                }} className={"text-link"}>
                            {" Отклонить "}
                          </button>
                        </div>
                      </Fragment> : null}
                    {activeRecord.value.owner === owner.value && (activeRecord.value.kind === "document" || activeRecord.value.status === "pending") ? <button onClick={event => {
              if (activeRecord.value.kind === "document") {
                if (page.value?.view === "booked") close();else goPage("booked");
              } else {
                stack.value = [];
                panel.value = "booked";
              }
            }} className={"campus-action"}>
                        {" Мои заявки "}
                      </button> : null}
                    {role.value !== "office" && activeRecord.value.kind === "booking" ? <Fragment>
                        {activeRecord.value.status === "approved" ? <button onClick={event => {
                filter.value = "Моё";
                route(1, activeRecord.value.date);
              }} className={"text-link"}>
                            {" Открыть расписание ↗"}
                          </button> : null}
                        {["pending", "approved"].includes(activeRecord.value.status) ? <button disabled={busy.value} onClick={event => {
                perform("cancel", {
                  id: activeRecord.value.id
                });
              }} className={"text-link"}>
                            {" Отменить заявку "}
                          </button> : null}
                      </Fragment> : null}
                    {activeRecord.value.status === "approved" && activeRecord.value.kind === "document" && role.value !== "office" ? <Fragment>
                        {activeRecord.value.format === "Электронная" && activeRecord.value.expires ? <Fragment>
                            <button disabled={Date.now() >= activeRecord.value.expires} onClick={event => {
                  download(activeRecord.value);
                }} className={"campus-action compact-action"}>
                              {" Скачать PDF"}
                            </button>
                            <small className={"footnote"}>
                              {"Ссылка действует 24 часа с момента выдачи, до "}
                              {new Date(activeRecord.value.expires).toLocaleString("ru-RU", {
                    timeZone: "Europe/Moscow"
                  })}
                              {" МСК."}
                            </small>
                          </Fragment> : activeRecord.value.format === "Бумажная" ? <p>
                            {" Студенческий офис · Б-214. Часы приёма: по будням с 10:00 до 16:00. "}
                          </p> : null}
                      </Fragment> : null}
                  </Fragment> : null}
                {panel.value === "finance" ? <PanelFinance /> : null}
                {panel.value === "notices" ? <PanelNotices /> : null}
                {panel.value === "letter" && !activeNote.value && <p role="status">Уведомление убрано из входящих.</p>}
                {panel.value === "letter" && activeNote.value ? <Fragment>
                    <small>{activeNote.value.ref?.startsWith("lesson:") ? "Учебная группа" : "Студенческий офис"}</small>
                    <h3>{activeNote.value.title}</h3>
                    <p className={"letter-text"}>{activeNote.value.body}</p>
                    {activeNote.value.ref?.startsWith("lesson:") && Object.values(schedule.value || {}).flat().some(event => event.id === activeNote.value.ref.slice(7)) && <button className="text-link" onClick={() => {
              const event = Object.values(schedule.value || {}).flat().find(event => event.id === activeNote.value.ref.slice(7));
              if (event) showEvent(event);
            }}>Открыть занятие</button>}
                    {records.value.some(r => r.id === activeNote.value.ref) ? <button onClick={event => {
              openRecord(records.value.find(r => r.id === activeNote.value.ref));
            }} className={"text-link"}>
                        {" Открыть обращение ↗ "}
                      </button> : null}
                  </Fragment> : null}
                {panel.value === "compose" && role.value === "office" ? <form onSubmit={event => {
            event.preventDefault();
            sendLetter(event);
          }} className={"letter-form"}>
                    <LetterRecipient owner={owner.value} value={letterTo.value} onChange={value => {
              letterTo.value = value;
            }} />
                    <label className={"field"}>
                      {"Тема"}
                      <input value={letterSubject.value ?? ""} onChange={event => {
                letterSubject.value = event.target.value;
              }} required maxLength="140" />
                    </label>
                    <label className={"field"}>
                      {"Текст письма"}
                      <textarea value={letterBody.value ?? ""} onChange={event => {
                letterBody.value = event.target.value;
              }} required maxLength="12000" rows="7" />
                    </label>
                    <button disabled={busy.value} className={"campus-action"}>
                      {" Отправить письмо "}
                    </button>
                  </form> : null}
                {panel.value === "wifi" ? <PanelWifi /> : null}

                {panel.value === "profile" ? <PanelProfile /> : null}
              </article>
            </Fragment>
          </div>
        </Dialog>;
}
