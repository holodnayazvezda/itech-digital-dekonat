import LoginForm from "../features/auth/LoginForm.jsx";
import { ArrowLeft } from "lucide-react";
import GlobalSearch from "../features/search/GlobalSearch.jsx";
import PhoneNavigation from "../shared/ui/PhoneNavigation.jsx";
import { mdiCalendarMonthOutline, mdiSchoolOutline, mdiApps, mdiArrowTopRight, mdiEmailOutline, mdiClipboardOutline } from "@mdi/js";
import { printDate, today } from "../shared/domain/timetable.js";
import PortalLoading, { PortalSection } from "../shared/ui/PortalLoading.jsx";
import { layoutForRoute } from "../shared/ui/portal-skeleton.js";
import LoginFrame from "../features/auth/LoginFrame.jsx";
import RequestList from "../features/documents/RequestList.jsx";
import { serviceDesign } from "../features/catalog/service-design.js";
import LessonHero from "../features/schedule/LessonHero.jsx";
import { people, rooms, gym, statuses } from "../shared/domain/campus-data.js";
import { Fragment, lazy } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Icon, Toast, classNames } from "../shared/ui/ui.jsx";
const CalendarView = lazy(() => import("../features/schedule/CalendarView.jsx"));
const CampusNavigator = lazy(() => import("../features/navigation/CampusNavigator.jsx"));
const FinanceView = lazy(() => import("../features/finance/FinanceView.jsx"));
const OfficeSchedule = lazy(() => import("../features/office/OfficeSchedule.jsx"));
const OfficeTodo = lazy(() => import("../features/office/OfficeTodo.jsx"));
const RoomFinder = lazy(() => import("../features/booking/RoomFinder.jsx"));
const ServiceCatalog = lazy(() => import("../features/catalog/ServiceCatalog.jsx"));
const ServiceForm = lazy(() => import("../features/documents/ServiceForm.jsx"));
const StudyGrades = lazy(() => import("../features/study/StudyGrades.jsx"));
const UniversityHub = lazy(() => import("./sections/UniversityHub.jsx"));
const WifiView = lazy(() => import("../features/wifi/WifiView.jsx"));
import { useCabinet } from "../shared/state/CabinetContext.jsx";
import CabinetDialogs from './CabinetDialogs.jsx';
export default function CabinetWorkspace() {
  useSignals();
  const {
    colors,
    theme,
    role,
    token,
    signing,
    navigation,
    loginCategory,
    connectionIssue,
    reconnectCabinet,
    logout,
    loginRole,
    password,
    enter,
    phone,
    assetBase,
    navRef,
    officeTab,
    route,
    open,
    visibleTab,
    tab,
    tabs,
    schedule,
    serviceItems,
    campusItems,
    goPage,
    focusPageHeading,
    updatePage,
    showEvent,
    selectItem,
    assistant,
    settingsMenu,
    studyRoot,
    page,
    studyHeight,
    leavePage,
    pageBackLabel,
    heading,
    financeName,
    pageNames,
    switchStudy,
    routeLayout,
    changeBooking,
    reservations,
    lessonChanges,
    owner,
    busy,
    submitRequest,
    records,
    openRecord,
    payments,
    wifiPassword,
    wifiReadyAt,
    wifiReadyTime,
    resetWifi,
    say,
    housing,
    account,
    findRoom,
    electives,
    messages,
    teachingGroups,
    avatars,
    perform,
    chooseService,
    assistantApi,
    nextLesson,
    lessonInProgress,
    countdown,
    lessons,
    homeAgenda,
    agendaRow,
    shortcuts,
    shortcut,
    topNotes,
    openNote,
    examBlock,
    scheduleRevision,
    filter,
    calendarDate,
    currentNavigation,
    bookings,
    demoMinute,
    scheduleDirectoryQuery,
    scheduleDirectoryLimit,
    filteredDirectory,
    grades,
    activeMark,
    openPhoneTab,
    phoneTabs,
    back,
    faculty,
    toast,
    message
  } = useCabinet();
  return <>
      <div style={colors.value} className={classNames("v-application", "v-theme--" + theme.value)}>
        {!role.value && token.value && !signing.value ? <PortalLoading wide layout={layoutForRoute(navigation.read(), sessionStorage.getItem("atlas-layout-role") || loginCategory.value)} title="Восстанавливаем кабинет" onRetry={connectionIssue.value ? reconnectCabinet : undefined} onExit={connectionIssue.value ? logout : undefined} /> : !role.value ? <LoginFrame style={colors.value}>
            <LoginForm people={people} busy={signing.value} onLogin={(identity, secret) => {
          loginRole.value = identity;
          password.value = secret;
          enter();
        }} />
          </LoginFrame> : <div className={classNames("shell", {
        "faculty-shell": role.value !== "student",
        "phone-shell": phone
      })}>
            <aside className={"rail"}>
              {!phone && <img className="header-logo" src={assetBase + "itech-logo.png"} alt="iTECH" width="80" height="28" />}
              {!phone && (role.value === "office" ? <nav ref={navRef} className="office-navigation" aria-label="Навигация кабинета">
                  {[["queue", "Обращения", mdiClipboardOutline], ["schedule", "Расписание", mdiCalendarMonthOutline], ["compose", "Письма", mdiEmailOutline], ["services", "Сервисы", mdiApps]].map(([key, label, ico]) => <button aria-current={officeTab === key ? "page" : undefined} onClick={event => {
              key === "services" ? route(4) : key === "queue" ? route(0) : key === "schedule" ? route(1) : open("compose");
            }} key={key} className={classNames({
              active: officeTab === key
            })}>
                      <Icon icon={ico} />
                      {label}
                    </button>)}
                </nav> : <nav ref={navRef} aria-label="Навигация кабинета">
                  {[1, 2, 4].map(i => <button key={i} hidden={!visibleTab(i)} aria-current={tab.value === i || i === 2 && tab.value === 5 ? "page" : undefined} onClick={event => {
              route(i);
            }} className={classNames({
              active: tab.value === i || i === 2 && tab.value === 5
            })}>
                      <Icon icon={tabs[i][1]} />
                      {tabs[i][0]}
                    </button>)}
                </nav>)}
                <div className={"tools"}>
                  <GlobalSearch people={people} schedule={schedule.value} services={[...serviceItems.value, ...campusItems.value]} rooms={rooms} onPerson={id => {
              goPage("person", id);
              focusPageHeading();
            }} onRoom={short => {
              updatePage({
                view: "navigator",
                peer: short,
                focusOnly: true
              });
              focusPageHeading();
            }} onLesson={event => {
              route(1, event.date);
              showEvent(event);
            }} onService={id => {
              selectItem(id);
              focusPageHeading();
            }} />
                  <div className="irishka-controls">
                  {!phone && assistant}
                  {settingsMenu}
                  </div>
                </div>
            </aside>
            <main>
              <div ref={studyRoot} className={classNames("workspace-start", {
            "study-workspace": !page.value && [2, 5].includes(tab.value)
          })} style={{
            minHeight: !page.value && [2, 5].includes(tab.value) ? studyHeight.value || undefined : undefined
          }}>
              <header className={classNames({
              "hub-heading": page.value,
              "study-root-heading": !page.value && [2, 5].includes(tab.value)
            })}>
                <div>
                  <p className={tab.value === 0 ? "date today-date" : "date"}>
                    {[printDate(today(), {
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                  }), "Осенний семестр · 2026", "Курс 2 · Семестр 3", "Студенческий офис", "Кампус", "Образовательная программа"][tab.value]}
                  </p>
                  {["wifi", "docs", "service-request", "booked", "directory", "person", "navigator", "finance", "spaces", "sports", "dorm", "residence"].includes(page.value?.view) && <button className={page.value.view === "wifi" ? "wifi-page-back" : "docs-page-back"} data-map-home={page.value.view === "navigator" && !page.value.peer ? true : undefined} onClick={leavePage}><ArrowLeft size={15} />{pageBackLabel.value}</button>}
                  {page.value?.view !== "person" && <h1 ref={heading} tabIndex="-1">
                    {page.value ? page.value.view === "finance" ? financeName.value : page.value.view === "service-request" ? page.value.peer : pageNames[page.value.view] : role.value === "office" && tab.value === 0 ? "Деканат" : [2, 5].includes(tab.value) ? "Учёба" : tabs[tab.value][0]}
                  </h1>}
                </div>

              </header>
              {!page.value && [2, 5].includes(tab.value) && <div className="study-toolbar"><div className="study-tabs" aria-label="Раздел учёбы"><button aria-current={tab.value === 2 ? "page" : undefined} onClick={() => switchStudy(2)}>Зачётка</button><button aria-current={tab.value === 5 ? "page" : undefined} onClick={() => switchStudy(5)}>Учебный план</button></div></div>}
              <Fragment>
                <section key={page.value ? page.value.view + "/" + page.value.peer : tab.value} className={classNames("view campus-route-view", {
                "service-page": Boolean(page.value),
                "study-pane": !page.value && [2, 5].includes(tab.value)
              })} data-service={page.value?.view} style={{
                "--service-accent": serviceDesign[page.value?.view]?.color
              }}>
                  <PortalSection layout={routeLayout}>
                  {["spaces", "sports", "booked", "finance", "wifi", "service-request"].includes(page.value?.view) ? <>
                      {!["wifi", "booked", "sports"].includes(page.value.view) && serviceDesign[page.value.view]?.description && <p className="service-page-intro">{serviceDesign[page.value.view].description}</p>}
                      {["spaces", "sports"].includes(page.value.view) && <RoomFinder sportsOnly={page.value.view === "sports"} schedule={schedule.value} initial={{
                      ...page.value,
                      short: page.value.peer || ""
                    }} onNavigate={page.value.view === "spaces" || page.value.peer && page.value.peer === gym?.short ? changeBooking : undefined} reservations={reservations.value} lessonChanges={lessonChanges.value} role={role.value} owner={owner.value} busy={busy.value} onSend={submitRequest} />}
                      {page.value.view === "booked" && <section className="service-surface requests-page"><div className="service-card-heading"><h2>История обращений</h2></div><RequestList records={records.value} onSelect={openRecord} /></section>}
                      {page.value.view === "finance" && <FinanceView role={role.value} payments={payments.value} />}
                      {page.value.view === "wifi" && <WifiView owner={owner.value} password={wifiPassword.value} readyAt={wifiReadyAt.value} readyTime={wifiReadyTime.value} busy={busy.value} onReset={resetWifi} onMessage={say} />}
                      {page.value.view === "service-request" && <div className="service-surface service-form-page"><ServiceForm key={page.value.peer} housing={housing.value} records={records.value} onRecord={openRecord} name={page.value.peer} person={account.value} busy={busy.value} onSubmit={submitRequest} /></div>}
                    </> : page.value?.view === "navigator" ? <CampusNavigator initialRoom={page.value.peer || ""} initialOrigin={page.value.fromPlace} initialFocusOnly={page.value.focusOnly} initialFromEntrance={page.value.fromEntrance} initialDate={page.value.date || today()} reservations={reservations.value} lessonChanges={lessonChanges.value} onRoom={["student", "teacher"].includes(role.value) ? (short, date) => findRoom(short, date || page.value.date || today()) : undefined} /> : page.value || tab.value === 5 ? <Fragment>
                    <UniversityHub view={page.value?.view || "plan"} peer={page.value?.peer || ""} rootPlan={tab.value === 5 && !page.value} housing={housing.value} electives={electives.value} owner={owner.value} messages={messages.value} teachingGroups={teachingGroups.value} lessonChanges={lessonChanges.value} avatars={avatars.value} records={records.value} busy={busy.value} send={perform} onGo={goPage} onBack={leavePage} onRecord={openRecord} onRequest={chooseService} />
                    </Fragment> : role.value === "office" && tab.value === 0 ? <section className={"content"}>
                      <OfficeTodo key={owner.value} request={assistantApi} records={records.value} onRecord={openRecord} />
                      <button onClick={event => {
                      open("compose");
                    }} className={"campus-action"}>
                        {" Написать письмо "}
                      </button>
                      <h2>{"Обращения"}</h2>
                      {!records.value.length ? <p>{"Обращений пока нет."}</p> : null}
                      {records.value.map(r => <button key={r.id} onClick={event => {
                      openRecord(r);
                    }} className={"case-row"}>
                          <span>
                            <b>{r.name}</b>
                            <small>
                              {people[r.owner]?.name || "Архивный кабинет"}
                              {" · "}
                              {r.kind === "booking" ? r.date + " · " + r.time + "–" + r.end : r.format}
                            </small>
                          </span>
                          <i className={classNames("badge " + r.status)}>
                            {statuses[r.status]}
                          </i>
                        </button>)}
                    </section> : tab.value === 0 ? <div className={"dashboard"}>
                      {nextLesson.value ? <LessonHero nextLesson={nextLesson.value} faculty={role.value === "teacher"} lessonInProgress={lessonInProgress.value} countdown={countdown.value} onLesson={event => {
                      showEvent(nextLesson.value);
                    }} onRoom={event => {
                      showEvent(nextLesson.value, "room");
                    }} onTeacher={event => {
                      showEvent(nextLesson.value, "teacher");
                    }} /> : <div className={"day-complete"}>
                          <h2>
                            {lessons.value.length ? "Пары на сегодня закончились" : "На сегодня обязательных занятий нет"}
                          </h2>
                        </div>}
                      <div className={"agenda"}>
                        <div className={"agenda-title"}>
                          <h2>{"Мой день"}</h2>
                          <button onClick={event => {
                          route(1);
                        }} className={"text-link"}>
                            {" Расписание "}
                            <Icon icon={mdiArrowTopRight} />
                          </button>
                        </div>
                        {homeAgenda.value.map(agendaRow)}
                        {shortcuts[shortcut.value] && <button className="pinned-action" onClick={() => selectItem(shortcut.value)}>
                            {shortcuts[shortcut.value]} <Icon icon={mdiArrowTopRight} />
                          </button>}
                      </div>
                      <aside className={"office"}>
                        <h2>
                          {role.value === "student" ? "Студенческий офис" : "Деканат"}
                        </h2>
                        {topNotes.value.map(n => <button key={n.id} onClick={event => {
                        openNote(n);
                      }} className={"notice-row"}>
                            <small>
                              {n.ref?.startsWith("chat:") && people[n.ref.slice(5)] ? "Личные сообщения" : "Деканат"}
                            </small>
                            <b>{n.title}</b>
                          </button>)}
                        <button onClick={event => {
                        open("notices");
                      }} className={"text-link"}>
                          {" Все уведомления ↗ "}
                        </button>
                        {role.value === "teacher" ? <button onClick={event => {
                        route(4, today(), {
                          navigate: false
                        });
                        goPage("directory");
                      }} className={"text-link"}>
                            {" Найти студента ↗ "}
                          </button> : null}
                        {examBlock()}
                      </aside>
                    </div> : tab.value === 1 && role.value === "office" ? <OfficeSchedule request={assistantApi} revision={scheduleRevision.value} onLesson={showEvent} /> : tab.value === 1 ? <div className={classNames("content", {
                    wide: filter.value === "Моё"
                  })}>
                      {filter.value === "Моё" ? <CalendarView initialDate={calendarDate.value} onDateChange={date => {
                      calendarDate.value = date;
                      void navigation.write(currentNavigation(), {
                        replace: true
                      });
                    }} schedule={schedule.value} bookings={bookings.value} role={role.value} owner={owner.value} demoMinute={demoMinute.value} onLesson={showEvent} onBooking={openRecord} onSpaces={d => findRoom("", d)} /> : <Fragment>
                          <h2>{filter.value}</h2>
                          <label className="hub-search">
                            <input type="search" aria-label="Поиск в расписаниях" placeholder={filter.value === "Преподаватели" ? "Фамилия, имя или отчество" : "Аудитория или корпус"} value={scheduleDirectoryQuery.value} onChange={event => {
                          scheduleDirectoryQuery.value = event.target.value;
                          scheduleDirectoryLimit.value = 24;
                        }} />
                          </label>
                          {filteredDirectory.value.length === 0 && <p>Совпадений нет.</p>}
                          {filteredDirectory.value.slice(0, scheduleDirectoryLimit.value).map((l, i) => <button key={i} onClick={event => {
                        showEvent(l, filter.value === "Преподаватели" ? "teacher" : "room");
                      }} className={"record"}>
                              <em>
                                {filter.value === "Преподаватели" ? "Ведёт" : l.building.name}
                              </em>
                              <span>
                                <b>
                                  {filter.value === "Преподаватели" ? l.teacher : l.room}
                                </b>
                                <small>{l.name}</small>
                              </span>
                            </button>)}
                          {filteredDirectory.value.length > scheduleDirectoryLimit.value && <button className="directory-more" onClick={() => {
                        scheduleDirectoryLimit.value += 24;
                      }}>Показать ещё</button>}
                        </Fragment>}
                    </div> : tab.value === 2 ? <StudyGrades grades={grades.value} expandedCourse={activeMark.value} onSelect={name => {
                    activeMark.value = activeMark.value === name ? null : name;
                  }} /> : tab.value === 4 ? <ServiceCatalog onSelect={key => key === "study" ? openPhoneTab(2) : selectItem(key)} groups={[{
                    title: null,
                    items: [...(phone && role.value === "student" ? [[mdiSchoolOutline, "Учёба", "Оценки и учебный план", "study"]] : []), ...serviceItems.value.filter(item => !["docs", "booked", "finance"].includes(item[3])), ...campusItems.value.filter(item => !["dorm", "electives", "directory", "threads", ...(phone && role.value === "student" ? ["navigator"] : [])].includes(item[3]))].sort((a, b) => ["study", "wifi", "sports", "spaces", "navigator"].indexOf(a[3]) - ["study", "wifi", "sports", "spaces", "navigator"].indexOf(b[3])),
                    kind: "campus"
                  }, {
                    title: "Заявки",
                    items: serviceItems.value.filter(item => ["docs", "booked"].includes(item[3])),
                    kind: "requests"
                  }, {
                    title: "Студенческая жизнь",
                    items: [...serviceItems.value.filter(item => item[3] === "finance"), ...campusItems.value.filter(item => ["dorm", "electives", "directory", "threads"].includes(item[3]))],
                    kind: "life"
                  }]} /> : <div className="content services-layout">
                      <div className={"service-catalog"}>
                        {(tab.value === 4 ? [...serviceItems.value, ...campusItems.value] : serviceItems.value).map(item => <button key={item[1]} onClick={event => {
                        selectItem(item[3]);
                      }} className={classNames("record", {
                        "mobile-requests": item[3] === "booked"
                      })}>
                            <em>
                              <Icon icon={item[0]} />
                            </em>
                            <span>
                              <b>{item[1]}</b>
                              <small>{item[2]}</small>
                            </span>
                          </button>)}
                      </div>
                      {tab.value === 3 ? <aside className={"services-requests"}>
                          <h2>{"Мои заявки"}</h2>
                          <RequestList records={records.value} onSelect={openRecord} />
                        </aside> : null}
                    </div>}
                  </PortalSection>
                </section>
              </Fragment>
              </div>

            </main>
            {phone && <PhoneNavigation items={phoneTabs} assistant={assistant} />}
          </div>}
        <CabinetDialogs />
        <Toast open={toast.value} onClose={() => {
        toast.value = false;
      }} timeout={2200}>
          {message.value}
        </Toast>
      </div>
    </>;
}
