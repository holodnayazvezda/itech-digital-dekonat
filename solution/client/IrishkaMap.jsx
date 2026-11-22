import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MapPin, Route } from "lucide-react";
import { campusRoute, indexPlaces, parseAtlas } from "./campus-map.js";
import { floorDirections } from "./campus-directions.js";
import CampusManeuver from "./CampusManeuver.jsx";
import RoutePlacePicker from "./RoutePlacePicker.jsx";
import { ReplyAction, ReplyPanelHeading } from "./IrishkaActions.jsx";
import "./irishka-map.css";

const FloorDrawing = lazy(() => import("./CampusFloor.jsx"));
let atlasEntries;
function loadMapEntries() {
  atlasEntries ??= fetch(import.meta.env.BASE_URL + "campus-map.json")
    .then(async response => {
      if (!response.ok) throw new Error("Карта недоступна");
      return indexPlaces(parseAtlas(await response.json()));
    })
    .catch(error => {
      atlasEntries = undefined;
      throw error;
    });
  return atlasEntries;
}

function mapPoint({ place, building, floor }) {
  return { id: place.id, name: place.name, code: place.code, buildingId: building.id, building: building.name, floorId: floor.id, floor: floor.name };
}

function placeName(place) {
  return place.code && !place.name.includes(place.code) ? `${place.name} ${place.code}` : place.name;
}

function fitsFloor(entry, scene) {
  return entry?.building === scene.building && entry?.floor === scene.floor;
}

export default function IrishkaMap({ block, onAction, actionHref }) {
  const source = block.type === "route" ? block.from : null;
  const target = block.type === "route" ? block.to : block.place;
  const [originId, setOriginId] = useState(source?.id ?? "");
  const [destinationId, setDestinationId] = useState(target.id);
  const [editable, setEditable] = useState(block.type === "route");
  const [entries, setEntries] = useState(undefined);
  const [floorIndex, setFloorIndex] = useState(0);
  const [floorId, setFloorId] = useState(null);
  useEffect(() => {
    let active = true;
    loadMapEntries().then(result => {
      if (active) setEntries(result);
    }).catch(() => { if (active) setEntries(null); });
    return () => { active = false; };
  }, []);
  const origin = entries?.find(entry => entry.place.id === originId);
  const destination = entries?.find(entry => entry.place.id === destinationId);
  const focus = destination || origin;
  const steps = useMemo(() => origin && destination && origin !== destination
    ? campusRoute(origin, destination)?.filter((step, index, route) =>
      index === 0 || index === route.length - 1 || step.points.length > 1 || step.transferTo
    )
    : null, [origin, destination]);
  const scene = steps?.[floorIndex] || (focus && {
    building: focus.building,
    floor: focus.building.floors.find(floor => floor.id === floorId) || focus.floor,
  });
  const route = steps?.[floorIndex] || null;
  const firstInstruction = route ? floorDirections(route)[0] : null;
  const selected = scene && (fitsFloor(destination, scene) ? destination : fitsFloor(origin, scene) ? origin : null);
  const place = destination ? mapPoint(destination) : entries === undefined || entries === null ? target : null;
  const from = origin ? mapPoint(origin) : entries === undefined || entries === null ? source : null;
  const navigate = place && { to: place, ...(from ? { from } : {}) };

  function chooseDestination(id) {
    setDestinationId(id || "");
    setFloorIndex(0);
    setFloorId(null);
  }

  function openRoute() {
    const entrance = entries.find(entry => entry.building === destination.building && entry.place.kind === "entrance");
    setOriginId(entrance?.place.id || "");
    setEditable(true);
    setFloorId(null);
  }

  return <section className="irishka-map irishka-reply-panel" aria-label={editable ? "Маршрут по кампусу" : "Место на карте"}>
    <ReplyPanelHeading icon={editable ? Route : MapPin} detail={!editable && place ? [place.building, place.floor].filter(Boolean).join(" · ") : null}>
      {editable ? "Маршрут по кампусу" : place ? placeName(place) : "Место на карте"}
    </ReplyPanelHeading>
    {editable && entries && <div className="irishka-map-points">
      <RoutePlacePicker label="Откуда" value={originId} entries={entries} onChange={entry => { setOriginId(entry?.place.id || ""); setFloorIndex(0); setFloorId(null); }} />
      <RoutePlacePicker label="Куда" value={destinationId} entries={entries} onChange={entry => chooseDestination(entry?.place.id)} />
    </div>}
    {steps?.length > 1 && <div className="irishka-map-floors" role="group" aria-label="Этаж маршрута">
      {steps.map((step, index) => <button key={index} type="button" aria-pressed={index === floorIndex} onClick={() => setFloorIndex(index)}>
        {origin.building !== destination.building && step.building.name + " · "}{step.floor.name}
      </button>)}
    </div>}
    {!!scene && !steps?.length && scene.building.floors.length > 1 && <div className="irishka-map-floors" role="group" aria-label="Этаж плана">
      {scene.building.floors.map(floor => <button key={floor.id} type="button" aria-pressed={floor === scene.floor} onClick={() => setFloorId(floor.id)}>
        {floor.name}
      </button>)}
    </div>}
    {scene ? <div className="atlas-nav irishka-map-drawing">
      <Suspense fallback={<p className="irishka-map-placeholder" role="status">Загружаю план…</p>}>
        <FloorDrawing key={scene.building.id + "/" + scene.floor.id} building={scene.building} floor={scene.floor}
          viewBox={scene.floor.viewBox || scene.building.viewBox} selected={selected?.place}
          onSelect={place => chooseDestination(place.id)} route={route} fitRoute={false} />
      </Suspense>
    </div> : <p className="irishka-map-placeholder" role="status">{entries === undefined ? "Загружаю план…" : entries === null || (!editable && !focus) ? "План недоступен" : "Выберите точки маршрута"}</p>}
    {editable && scene && !(steps?.length > 1) && <p className="irishka-map-note">{scene.building.name} · {scene.floor.name}</p>}
    {firstInstruction && <div className="irishka-map-instruction"><CampusManeuver instruction={firstInstruction} /></div>}
    {scene?.transferTo && <p className="irishka-map-note">{scene.transferTo}</p>}
    {scene?.exitVia && !scene.transferTo && <p className="irishka-map-note">{scene.exitVia}</p>}
    {origin && destination && !steps?.length && <p className="irishka-map-note" role="status">{origin === destination ? "Выберите разные точки." : "Между этими точками нет прохода на карте."}</p>}
    <footer className="irishka-reply-actions">
      {!editable && destination && <button type="button" className="irishka-action-chip" onClick={openRoute}><Route size={15} aria-hidden="true" />Маршрут сюда</button>}
      {navigate && <ReplyAction action="navigator" detail={navigate} onAction={onAction} actionHref={actionHref}>{route ? "Далее в навигаторе" : "Открыть на карте"}<ArrowUpRight size={15} aria-hidden="true" /></ReplyAction>}
    </footer>
  </section>;
}
