import FloorDrawing, {categoryIcon, clamp, placeTitle} from "./CampusFloor.jsx";
import {floorDirections} from "./campus-directions.js";
import CampusManeuver from "./CampusManeuver.jsx";
import RoutePlacePicker from "./RoutePlacePicker.jsx";
import {usePhoneLayout} from "./PhoneNavigation.jsx";
import {ArrowUpDown,Navigation,ChevronDown} from "lucide-react";
import {use, useEffect, useId, useMemo, useRef, useState} from "react";
import {
  mdiArrowTopRight, mdiChevronLeft, mdiChevronRight, mdiClose,
  mdiDomain, mdiMagnify, mdiMapMarkerPath,
} from "@mdi/js";
import {roomActivities, rooms} from "../shared/campus-data.js";
import {today} from "../shared/timetable.js";
import {campusRoute, entryFloor, findPlaces, indexPlaces, normalise, parseAtlas, placeKinds} from "./campus-map.js";
import {Icon} from "./ui.jsx";

const quickFilters = [
  ["food", "Питание"], ["work", "Коворкинги"], ["student-office", "Студофис"],
  ["library", "Библиотека"], ["water", "Вода"], ["wc", "Туалеты"],
];
const bookableRooms = new Set(rooms.map(room => room.short));
function Occupancy({code,reservations,date,setDate,lessonChanges}) {
  const events=useMemo(()=>date ? [
    ...roomActivities(date,lessonChanges).filter(e=>e.room===code),
    ...reservations.filter(r=>r.short===code && r.date===date).map(r=>({
      time:r.time,end:r.end,name:"Бронирование",teacher:r.by,
    })),
  ].sort((a,b)=>a.time.localeCompare(b.time)):[],[code,date,reservations,lessonChanges]);
  return <div className="atlas-occupancy">
    <label>Занятость помещения<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {events.length ? <ul>{events.map((e,i)=><li key={i}><time>{e.time}–{e.end}</time>
      <div><b>{e.name}</b>{e.teacher && <small>{e.teacher}</small>}</div></li>)}</ul> :
      <p>{date ? "В расписании на эту дату событий нет." : "Выберите дату."}</p>}
  </div>;
}

function FloorDirectory({floor, onSelect}) {
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(8);
  const places = useMemo(() => [...floor.places].sort((a, b) =>
    Number(a.kind === "class") - Number(b.kind === "class") ||
    (a.code || a.name).localeCompare(b.code || b.name, "ru", {numeric:true})), [floor]);
  const visible = places.filter(p => category === "all" || (p.kind === "class") === (category === "rooms"));
  return <>
    <h2>На этаже</h2>
    {places.length > 12 && <div className="atlas-index-tabs" role="group" aria-label="Список мест этажа">
      {[["all","Все"],["rooms","Аудитории"],["services","Сервисы"]].map(([key, label]) =>
        <button key={key} aria-pressed={category === key} onClick={() => { setCategory(key); setLimit(8); }}>{label}</button>)}
    </div>}
    <div className="atlas-floor-directory">{visible.slice(0, limit).map(place=><button key={place.id}
      onClick={()=>onSelect(place)}><Icon icon={categoryIcon(place.kind)}/>
      <span>{placeTitle(place)}</span><Icon icon={mdiChevronRight}/></button>)}</div>
    {visible.length === 0 && <p>В этой категории пока нет мест.</p>}
    {visible.length > limit && <button className="atlas-link" onClick={() => setLimit(limit + 16)}>Показать ещё ({visible.length-limit})</button>}
  </>;
}

function RouteCard({steps, index, destination, origin, onStep, onFinish}) {
  const card=useRef(null),touch=useRef(null),previous=useRef(index);
  const step=steps[index],next=steps[index+1];
  const directions=floorDirections(step);
  const from=index===0?origin || "Вход":step.entryVia || "Переход";
  const to=next?step.exitVia || "Переход":destination;
  const direction=previous.current>index?"back":"forward";
  useEffect(()=>{previous.current=index;},[index]);
  useEffect(()=>{
    card.current.focus({preventScroll:true});
    card.current.closest(".atlas-board").scrollIntoView({block:"nearest"});
  },[]);
  function move(delta){const target=index+delta;if(target>=0 && target<steps.length)onStep(target);}
  return <section className="atlas-route-card atlas-route-modern" aria-label="Шаги маршрута" tabIndex={-1} ref={card}
    onKeyDown={e=>{if(e.key==="ArrowLeft" || e.key==="ArrowRight"){e.preventDefault();move(e.key==="ArrowLeft"?-1:1);}}}>
    <div className="atlas-route-caption"><small>Шаг {index+1} из {steps.length} · {step.building?.name} · {step.floor.name}</small><span>Пешком</span></div>
    <div className="atlas-slide-wrap" aria-live="polite" aria-atomic="true"
      onTouchStart={e=>{const t=e.touches[0];touch.current=e.touches.length===1?[t.clientX,t.clientY]:null;}}
      onTouchCancel={()=>{touch.current=null;}}
      onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1];if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);}}>
      <div key={index} className="atlas-route-slide" data-direction={direction}>
        <span className="atlas-route-origin">{from} → <strong>{to}</strong></span>
        {!!directions.length && <ol className="atlas-route-directions" aria-label="Повороты на этаже" tabIndex={directions.length > 3 ? 0 : undefined}>
          {directions.map((instruction, position) => <li key={position}><CampusManeuver instruction={instruction} /></li>)}
        </ol>}
        {step.transferTo?<span className="atlas-route-hint">{step.transferTo}</span>:next?<span className="atlas-route-hint">Далее — {next.floor.name}</span>:null}
      </div>
    </div>
    {steps.length>1 && <div className="atlas-route-segments" role="progressbar" aria-label="Ход маршрута" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index+1}>{steps.map((_,i)=><i key={i} data-complete={i<=index}/>)}</div>}
    <div className="atlas-route-actions">
      {index>0 && <button type="button" className="atlas-route-back" aria-label="Предыдущий шаг" onClick={()=>move(-1)}><Icon icon={mdiChevronLeft}/></button>}
      <button type="button" className="atlas-route-next" onClick={()=>next?move(1):onFinish()}>{next?"Далее":"Завершить"}<Icon icon={mdiChevronRight}/></button>
    </div>
  </section>;
}

function Atlas({atlas,initialRoom,initialOrigin,initialFocusOnly,initialDate,initialFromEntrance,onRoom,reservations,lessonChanges}) {
  const phone = usePhoneLayout();
  const [date,setDate]=useState(initialDate || today());
  const entries=useMemo(()=>indexPlaces(atlas),[atlas]), searchId=useId();
  const [buildingId,setBuildingId]=useState(atlas.buildings[0].id);
  const [originId,setOriginId]=useState(()=>entries.find(e=>e.building===atlas.buildings[0] && e.place.kind==="entrance")?.place.id || "");
  const [routeError,setRouteError]=useState("");
  const builderButton=useRef(null), routeSource=useRef("builder");
  const [floorId,setFloorId]=useState(entryFloor(atlas.buildings[0]).id);
  const [routeFrame, setRouteFrame] = useState(0);
  const [selectedId,setSelected]=useState(null), [focusPoint,setFocusPoint]=useState(null);
  const [query,setQuery]=useState(""),[category,setCategory]=useState("");
  const [stepIndex, setStepIndex] = useState(null);
  const routing = stepIndex !== null;
  const routeButton = useRef(null);
  const [resultLimit, setResultLimit] = useState(24);
  const searchInput=useRef(null),resultsBox=useRef(null);
  const building=atlas.buildings.find(b=>b.id===buildingId) || atlas.buildings[0];
  const floor=building.floors.find(f=>f.id===floorId) || building.floors[0];
  const viewBox = building.footprint ? building.viewBox : floor.viewBox || building.viewBox;
  const selected=entries.find(e=>e.place.id===selectedId);
  const origin=entries.find(e=>e.place.id===originId);
  const route=useMemo(()=>campusRoute(origin,selected),[origin,selected]);
  const routeSteps=route?.filter((step,i)=>step.points.length>1 || step.transferTo || i===0 || i===route.length-1) || [];
  const searching=Boolean(query.trim() || category);
  const results=useMemo(()=>searching ? findPlaces(entries,query,category):[],[entries,query,category,searching]);
  const matches=useMemo(()=>searching?new Set(results.map(r=>r.place.id)):null,[results,searching]);
  function resetSearch(){setQuery("");setCategory("");}
  function select(entry, focus=false, fromEntrance=false, focusOnly=false){
    setBuildingId(entry.building.id);setFloorId(entry.floor.id);setSelected(entry.place.id);
    setFocusPoint(focus ? [...entry.place.anchor] : null);setStepIndex(null);setRouteError("");resetSearch();
    if (fromEntrance) startEntranceRoute(entry);
    else if (origin && !focusOnly) beginRoute(origin,entry);
  }
  useEffect(()=>{
    if(!initialRoom)return;
    const code=normalise(initialRoom).replaceAll(" ","");
    const destination=entries.find(entry=>entry.place.id===initialRoom)
      || entries.find(entry=>entry.place.code && normalise(entry.place.code).replaceAll(" ","")===code);
    const start=entries.find(entry=>entry.place.id===initialOrigin);
    if(destination && start)beginRoute(start,destination);
    else if(destination)select(destination,true,initialFromEntrance,initialFocusOnly);
    else setQuery(initialRoom);
  },[entries,initialRoom,initialOrigin,initialFromEntrance,initialFocusOnly]);
  function switchBuilding(next){
    const b=atlas.buildings.find(item=>item.id===next);
    setBuildingId(next);setFloorId(entryFloor(b).id);setSelected(null);setFocusPoint(null);setStepIndex(null);resetSearch();
  }
  function switchFloor(next){
    if (routing) {
      if (floorId === next) return;
      const index = routeSteps.findIndex(step => step.floor.id === next && step.building.id === building.id);
      if (index >= 0) { showStep(index); return; }
    }
    setFloorId(next);setFocusPoint(null);setSelected(null);setStepIndex(null);resetSearch();
  }
  function showStep(index) {
    if (!routeSteps[index]) return;
    setBuildingId(routeSteps[index].building.id);
    setFloorId(routeSteps[index].floor.id);
    setStepIndex(index);
    setFocusPoint(null);
    setRouteFrame(n => n + 1);
  }
  function beginRoute(from=origin,to=selected,source="builder") {
    setRouteError("");
    if (!from || !to) return;
    if (from.place.id === to.place.id) {setRouteError("Выберите разные начальную и конечную точки.");return;}
    const steps=campusRoute(from,to);
    if (!steps?.length) {setRouteError("Для этих точек маршрут на схеме недоступен. Выберите другое место.");return;}
    routeSource.current=source;
    setOriginId(from.place.id);setSelected(to.place.id);setBuildingId(steps[0].building.id);setFloorId(steps[0].floor.id);
    setStepIndex(0);setFocusPoint(null);setRouteFrame(n=>n+1);resetSearch();
  }
  function startEntranceRoute(destination) {
    const start = entries.find(entry => entry.building === destination.building && entry.place.kind === "entrance");
    if (!start) {
      setRouteError("На плане этого корпуса не отмечен вход. Выберите начальную точку на карте.");
      return;
    }
    beginRoute(start,destination,"entrance");
  }
  function changeOrigin(entry) {
    setOriginId(entry?.place.id || "");setStepIndex(null);setRouteError("");
    if(entry && selected)beginRoute(entry,selected);
  }
  function changeDestination(entry) {
    setRouteError("");
    if(entry)select(entry,true);else {setSelected(null);setStepIndex(null);setFocusPoint(null);}
  }
  function swapPoints() {
    if (!origin || !selected) return;
    setOriginId(selected.place.id);setStepIndex(null);beginRoute(selected,origin);
  }
  function stopRoute(){
    setStepIndex(null);
    if(selected){setBuildingId(selected.building.id);setFloorId(selected.floor.id);setFocusPoint([...selected.place.anchor]);}
    requestAnimationFrame(()=>{
      if(document.activeElement===document.body)(routeSource.current==="entrance"?routeButton.current:builderButton.current)?.focus({preventScroll:true});
    });
  }
  function handleSearchKeys(e){
    if(e.key==="Escape"){resetSearch();searchInput.current?.focus();}
    if(e.key==="Enter" && e.target===searchInput.current && results[0]){e.preventDefault();select(results[0],true);}
    if(["ArrowDown","ArrowUp"].includes(e.key)&&resultsBox.current){
      const buttons=[...resultsBox.current.querySelectorAll("button")];
      if(!buttons.length)return;
      e.preventDefault();
      const pos=buttons.indexOf(document.activeElement),delta=e.key==="ArrowDown"?1:-1;
      buttons[clamp(pos+delta,0,buttons.length-1)].focus();
    }
  }
  const floorControls = (
    <div className="atlas-levels" role="group" aria-label="Выбрать этаж">
            <span>Этаж</span>
            {building.floors.map(f=><button key={f.id} aria-pressed={f.id===floor.id} aria-label={f.name}
              onClick={()=>switchFloor(f.id)}>{f.shortLabel ?? f.id}</button>)}
          </div>
  );
  return <section className="atlas-nav" aria-label="Навигатор кампуса">
    <form className="atlas-route-builder" onSubmit={e=>{e.preventDefault();beginRoute();}}>
      <RoutePlacePicker label="Откуда" value={originId} entries={entries} onChange={changeOrigin}/>
      <button type="button" className="atlas-route-swap" aria-label="Поменять точки местами" disabled={!origin || !selected} onClick={swapPoints}><ArrowUpDown size={18}/></button>
      <RoutePlacePicker label="Куда" value={selectedId} entries={entries} onChange={changeDestination}/>
      <button className="atlas-route-build" ref={builderButton} disabled={!origin || !selected}><Navigation size={17}/>Построить маршрут</button>
      {routeError && <p className="atlas-route-error" role="alert">{routeError}</p>}
    </form>
    <div className="atlas-search-tools" onKeyDown={handleSearchKeys}>
      {!phone && <label className="atlas-search"><Icon icon={mdiMagnify}/><input type="search" ref={searchInput} value={query}
        aria-label="Поиск по карте" aria-controls={searchId} autoComplete="off" placeholder="Аудитория, место или корпус"
        onChange={e=>{setQuery(e.target.value);setResultLimit(24);}}/></label>}
      <div className="atlas-filters" role="group" aria-label="Категории мест">
        {quickFilters.map(([key,label])=><button key={key} aria-pressed={category===key}
          onClick={()=>{setCategory(category===key?"":key);setResultLimit(24);}}><Icon icon={categoryIcon(key==="student-office"?"office":key)}/>{label}</button>)}
      </div>
      {searching && <section className="atlas-results" id={searchId} aria-label="Результаты поиска">
        <div className="atlas-result-header"><b role="status">Найдено · {results.length}</b>
          <button onClick={()=>{resetSearch();searchInput.current?.focus();}}>Сбросить</button></div>
        <div className="atlas-result-list" ref={resultsBox}>
          {results.slice(0, resultLimit).map(entry=><button key={entry.place.id} onClick={()=>select(entry,true)}>
            <Icon icon={categoryIcon(entry.place.kind)}/><span><b>{placeTitle(entry.place)}</b>
            <small>{entry.building.name} · {entry.floor.name}</small></span><Icon icon={mdiChevronRight}/></button>)}
          {!results.length && <p>Попробуйте номер аудитории или другое название.</p>}
        </div>
        {results.length > resultLimit && <button className="atlas-link" onClick={()=>setResultLimit(resultLimit+24)}>Показать ещё результаты ({results.length-resultLimit})</button>}
      </section>}
    </div>
    <div className="atlas-layout">
      <div className="atlas-board" data-routing={routing}>
        <div className="atlas-board-head">
          <label className="atlas-campus"><Icon icon={mdiDomain}/><select aria-label="Корпус на карте"
            value={building.id} onChange={e=>switchBuilding(e.target.value)}>
            {atlas.buildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label>
          {!phone && floorControls}
        </div>
        {routing && routeSteps.length>0 && <RouteCard steps={routeSteps} index={stepIndex} origin={origin?.place.code || origin?.place.name} destination={selected.place.code || selected.place.name}
          onStep={showStep} onFinish={stopRoute}/>}
        <FloorDrawing key={[building.id, ...viewBox, routeFrame].join("|")} building={building} floor={floor} viewBox={viewBox} selected={selected?.place}
          onSelect={(place,focus)=>select({building,floor,place},focus)} route={routing ? routeSteps[stepIndex] || null : null}
          focusPoint={focusPoint} matches={matches}/>
        {phone && <div className="atlas-mobile-floors">{floorControls}</div>}
        <div className="atlas-board-foot"><span><i/>{floor.name}</span></div>
      </div>
      <aside className="atlas-inspector" aria-label="Информация о месте">
        {selected ? <>
          <div className="atlas-inspector-top"><span className="atlas-category"><Icon icon={categoryIcon(selected.place.kind)}/>
            {placeKinds[selected.place.kind] || "Место"}</span>
            <button aria-label="Снять выделение" onClick={()=>{setSelected(null);setFocusPoint(null);setStepIndex(null);}}><Icon icon={mdiClose}/></button></div>
          <h2>{placeTitle(selected.place)}</h2>
          <p>{selected.building.name} · {selected.floor.name}{selected.place.zone && " · "+selected.place.zone}</p>
          {!routing && <button className="atlas-set-origin" onClick={()=>{setOriginId(selected.place.id);setSelected(null);setStepIndex(null);setRouteError("");}}>Начать маршрут отсюда</button>}
          {routeSteps.length>0 && !routing && <button className="atlas-primary" ref={routeButton} onClick={()=>startEntranceRoute(selected)}><Icon icon={mdiMapMarkerPath}/>Как пройти от входа</button>}
          {routing && <button className="atlas-link" onClick={stopRoute}>Скрыть маршрут</button>}
          {selected.place.code && (bookableRooms.has(selected.place.code) || selected.place.kind==="class") && <>
            <Occupancy code={selected.place.code} reservations={reservations} date={date} setDate={setDate} lessonChanges={lessonChanges}/>
            {onRoom && bookableRooms.has(selected.place.code) && <button className="atlas-link" disabled={!date || date<today() || date>"2026-12-28"} onClick={()=>onRoom(selected.place.code,date)}>Выбрать время брони <Icon icon={mdiArrowTopRight}/></button>}
          </>}
        </> : <FloorDirectory key={building.id + "/" + floor.id} floor={floor} onSelect={place=>select({building,floor,place},true)}/>}
      </aside>
    </div>
  </section>;
}

let atlasRequest;

function loadAtlas() {
  return fetch(import.meta.env.BASE_URL + "campus-map.json", { cache: "no-cache" })
    .then(async response => {
      if (!response.ok) throw new Error();
      return parseAtlas(await response.json());
    })
    .catch(() => null);
}

export default function CampusNavigator({initialRoom="",initialOrigin="",initialFocusOnly=false,initialDate=today(),initialFromEntrance=false,onRoom,reservations=[],lessonChanges=[]}) {
  const [, retry] = useState(0);
  const atlas = use(atlasRequest ||= loadAtlas());
  if (!atlas) return <div className="atlas-load" role="alert">
    <p>Не удалось загрузить план кампуса.</p>
    <button type="button" onClick={() => { atlasRequest = loadAtlas(); retry(attempt => attempt + 1); }}>Повторить</button>
  </div>;
  return <Atlas atlas={atlas} initialRoom={initialRoom} initialOrigin={initialOrigin} initialFocusOnly={initialFocusOnly} initialDate={initialDate} initialFromEntrance={initialFromEntrance}
    onRoom={onRoom} reservations={reservations} lessonChanges={lessonChanges}/>;
}
