import {useEffect, useId, useMemo, useRef, useState} from "react";
import {
  mdiAccountGroupOutline, mdiBadminton, mdiBookOpenPageVariantOutline, mdiClipboardTextOutline,
  mdiDoorOpen, mdiElevatorPassengerOutline, mdiFitToScreenOutline, mdiHanger,
  mdiHumanMaleFemale, mdiInformationOutline, mdiMinus, mdiPlus,
  mdiSchoolOutline, mdiSilverwareForkKnife, mdiStairs, mdiWaterOutline,
} from "@mdi/js";
import {routeMidpoint} from "./campus-map.js";
import {mapProjection} from "./map-projection.js";
import {Icon} from "./ui.jsx";
import "./navigator.css";

const icons = {
  class: mdiSchoolOutline, office: mdiClipboardTextOutline, library: mdiBookOpenPageVariantOutline,
  work: mdiAccountGroupOutline, food: mdiSilverwareForkKnife, lift: mdiElevatorPassengerOutline,
  cloakroom: mdiHanger, stairs: mdiStairs, water: mdiWaterOutline, wc: mdiHumanMaleFemale, entrance: mdiDoorOpen, sport: mdiBadminton,
};
export const categoryIcon = kind => icons[kind] || mdiInformationOutline;
export const placeTitle = place => [place.name, place.code].filter(Boolean).join(" ");
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const maxZoom = 8;
const roomNumber = place => place.code?.split(/[-–]/).at(-1) || place.label || place.name;

function visibleRoomNumbers(floor, selected, scale, fontSize) {
  const named = floor.places.filter(p => p.kind === "class" && p.path);
  if (selected) named.sort((a, b) => Number(b.id === selected.id) - Number(a.id === selected.id));
  const occupied = floor.places.filter(p => p.kind !== "class").map(p => ({
    x:p.anchor[0], y:p.anchor[1], w:22, h:18,
  }));
  const visible = new Set();
  for (const place of named) {
    const [x, y] = place.anchor;
    const w = (roomNumber(place).length * .6 + .6) * fontSize / 2;
    const h = fontSize * .62 + 1.5 / scale;
    if (place.id !== selected?.id && occupied.some(r => Math.abs(x-r.x)<w+r.w && Math.abs(y-r.y)<h+r.h)) continue;
    visible.add(place.id);
    occupied.push({x, y, w, h});
  }
  return visible;
}

// Extrude straight room contours into low cutaway walls; curves keep their original plan.
function roomWalls(path, offset=[0,-24], front=([dx])=>dx<0) {
  if(!path || /[^MLZ\d.,\s-]/i.test(path))return [];
  const rings=path.match(/M[^M]+/gi) || [];
  return rings.flatMap(ring=>{
    const points=[...ring.matchAll(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]);
    return points.map(([x,y],i)=>{
      const [nx,ny]=points[(i+1)%points.length];
      const [ox,oy]=offset;
      return {d:`M${x} ${y}L${nx} ${ny}L${nx+ox} ${ny+oy}L${x+ox} ${y+oy}Z`,front:front([nx-x,ny-y])};
    });
  });
}

export default function FloorDrawing({building, floor, viewBox, selected, onSelect, route, focusPoint, matches, fitRoute = true}) {
  const [x, y, width, height] = viewBox;
  const [angle,setAngle]=useState(-18),[tilt,setTilt]=useState(42);
  const threeD=true, cubeDrag=useRef(null), cubeToggle=useRef(null), cubeId=useId();
  const [showCube,setShowCube]=useState(false);
  const projection=useMemo(()=>mapProjection(viewBox,threeD?angle:0,threeD?tilt:0),[viewBox,angle,tilt,threeD]);
  const orderedPlaces=useMemo(()=>[...floor.places].sort((a,b)=>projection.depth(a.anchor)-projection.depth(b.anchor)),[floor,projection]);
  const dense = floor.places.filter(p => p.kind === "class").length >= 12;
  const base = {x:x + width/2, y:y + height/2, zoom:1};
  const [camera, setCamera] = useState(base);
  const svg = useRef(null), drag = useRef(null), skipClick = useRef(false);
  const pointers = useRef(new Map());
  const [unitScale, setUnitScale] = useState(1);
  useEffect(() => {
    const el = svg.current;
    const observer = new ResizeObserver(() => setUnitScale(Math.min(el.clientWidth/width, el.clientHeight/height) || 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);
  const scaleOnScreen = unitScale * camera.zoom;
  const fontSize = clamp(11.5 / scaleOnScreen, 13, 49);
  const visibleNumbers = useMemo(() => dense ? visibleRoomNumbers(floor, selected, scaleOnScreen, fontSize) : null,
    [dense, floor, selected, scaleOnScreen, fontSize]);
  function bound(next) {
    const halfWidth = width / next.zoom / 2, halfHeight = height / next.zoom / 2;
    return {...next, x:clamp(next.x, x+halfWidth-width*.25, x+width-halfWidth+width*.25),
      y:clamp(next.y, y+halfHeight-height*.25, y+height-halfHeight+height*.25)};
  }
  useEffect(() => {
    if (focusPoint) {
      const [px, py] = projection.point(focusPoint);
      const size = svg.current.getBoundingClientRect();
      const overviewScale = Math.min(size.width / width, size.height / height);
      setCamera(bound({x:px, y:py, zoom:dense ? clamp(.86 / overviewScale, 1.65, maxZoom) : 1.65}));
    }
  }, [focusPoint,projection]);
  useEffect(() => {
    if (!route || !fitRoute) return;
    const points = selected && floor.places.includes(selected) ? [...route.points, selected.anchor] : route.points;
    const projected=points.map(projection.point);
    const xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const zoom = clamp(Math.min(width / (right-left+width*.12), height / (bottom-top+height*.15)), 1, 3.5);
    setCamera(bound({x:(left+right)/2, y:(top+bottom)/2, zoom}));
  }, [route,projection,fitRoute]);
  function scale(factor) {
    setCamera(old => bound({...old, zoom:clamp(old.zoom*factor, 1, maxZoom)}));
  }
  function pan(dx, dy) {
    setCamera(old => bound({...old, x:old.x+dx/old.zoom, y:old.y+dy/old.zoom}));
  }
  function keyMap(e) {
    if (e.target !== svg.current) return;
    const keys = {ArrowLeft:[-width/9,0],ArrowRight:[width/9,0],ArrowUp:[0,-height/9],ArrowDown:[0,height/9]};
    if (keys[e.key]) { e.preventDefault(); pan(...keys[e.key]); }
    else if (["+", "=", "-","Home"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Home") setCamera(base); else scale(e.key === "-" ? 0.75 : 1.33);
    }
  }
  function centerOffset(clientX,clientY) {
    const rect=svg.current.getBoundingClientRect();
    return [clientX-rect.left-rect.width/2, clientY-rect.top-rect.height/2];
  }
  useEffect(()=>{
    const el=svg.current;
    function wheel(e){
      if(!e.ctrlKey && !e.metaKey)return;
      e.preventDefault();
      const [dx,dy]=centerOffset(e.clientX,e.clientY);
      const factor=Math.exp(-clamp(e.deltaY,-100,100)*0.012);
      setCamera(old=>{
        const pixels=Math.min(el.clientWidth/(width/old.zoom),el.clientHeight/(height/old.zoom));
        const zoom=clamp(old.zoom*factor,1,maxZoom);
        const ratio=(1-old.zoom/zoom)/pixels;
        return bound({zoom,x:old.x+dx*ratio,y:old.y+dy*ratio});
      });
    }
    el.addEventListener("wheel",wheel,{passive:false});
    return ()=>el.removeEventListener("wheel",wheel);
  },[width,height]);
  function begin(e) {
    if(e.button!==0 || pointers.current.size >= 2)return;
    pointers.current.set(e.pointerId,[e.clientX,e.clientY]);
    const touches=[...pointers.current.values()];
    const pixels=svg.current.getScreenCTM()?.a || 1;
    if(touches.length===2) {
      const [[ax,ay],[bx,by]]=touches;
      const [dx,dy]=centerOffset((ax+bx)/2,(ay+by)/2);
      drag.current={mode:"pinch",camera,pixels,distance:Math.max(1,Math.hypot(bx-ax,by-ay)),
        world:[camera.x+dx/pixels,camera.y+dy/pixels]};
      for(const id of pointers.current.keys())svg.current.setPointerCapture(id);
      skipClick.current=true;
    } else if(touches.length===1) {
      skipClick.current=false;
      drag.current={mode:"pan",id:e.pointerId,x:e.clientX,y:e.clientY,camera,pixels,angle,tilt};
    }
  }
  function move(e) {
    const start=drag.current;
    if(!start || !pointers.current.has(e.pointerId))return;
    pointers.current.set(e.pointerId,[e.clientX,e.clientY]);
    if(start.mode==="pinch") {
      const [a,b]=pointers.current.values();
      if(!b)return;
      const [dx,dy]=centerOffset((a[0]+b[0])/2,(a[1]+b[1])/2);
      const zoom=clamp(start.camera.zoom*Math.hypot(a[0]-b[0],a[1]-b[1])/start.distance,1,maxZoom);
      const pixels=start.pixels*zoom/start.camera.zoom;
      setCamera(bound({zoom,x:start.world[0]-dx/pixels,y:start.world[1]-dy/pixels}));
      return;
    }
    if(start.id!==e.pointerId)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(!skipClick.current && Math.hypot(dx,dy)<4)return;
    if(!skipClick.current)svg.current.setPointerCapture(e.pointerId);
    skipClick.current=true;
    setCamera(bound({...start.camera,x:start.camera.x-dx/start.pixels,y:start.camera.y-dy/start.pixels}));
  }
  function end(e){
    if (!pointers.current.delete(e.pointerId)) return;
    const remaining = pointers.current.entries().next().value;
    if (remaining) {
      const [id, [x, y]] = remaining;
      drag.current = {mode:"pan", id, x, y, camera, pixels:svg.current.getScreenCTM()?.a || 1};
    } else {
      drag.current = null;
    }
  }
  const arrow = useMemo(() => route && routeMidpoint(route.points), [route]);
  const shownWidth=width/camera.zoom, shownHeight=height/camera.zoom;
  return <div className="atlas-drawing" onCopy={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()}>
    <svg ref={svg} viewBox={[camera.x-shownWidth/2,camera.y-shownHeight/2,shownWidth,shownHeight].join(" ")}
      role="group" aria-label={building.name + ", " + floor.name + ". Поэтажный план"} tabIndex="0"
      className="atlas-svg" data-3d={threeD} data-angle={angle} data-tilt={tilt} data-dense={dense} data-overview={scaleOnScreen < .55} data-zoomed={camera.zoom > 1}
      onKeyDown={keyMap} onPointerDown={begin} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end} onPointerLeave={e=>{if(!svg.current.hasPointerCapture(e.pointerId))end(e);}}
      onClickCapture={e=>{if(skipClick.current){e.stopPropagation();skipClick.current=false;}}}>
      <g className="atlas-scene" transform={`matrix(${projection.matrix.join(" ")})`}>
      {building.footprint && <path d={building.footprint} fillRule="evenodd" className="atlas-footprint" pointerEvents="none" aria-hidden="true"/>}
      <path d={floor.outline} fillRule="evenodd" className="atlas-shell"/>
      {orderedPlaces.map(place => {
        const [px,py]=place.anchor;
        const node=floor.nodes?.[place.node], picked=selected?.id===place.id;
        const pointOnly=!place.path;
        const numbered = place.kind === "class" && Boolean(place.code);
        const showNumber = numbered && (!dense || pointOnly || visibleNumbers.has(place.id));
        const selectHere = () => onSelect(place, dense && scaleOnScreen < .4);
        const iconSize = dense ? clamp(14 / scaleOnScreen, 17, 54) : pointOnly ? 16 : 20;
        const cloakroom = place.kind === "cloakroom" || (place.kind === "service" && place.name === "Гардероб");
        const symbolSize = cloakroom ? Math.min(iconSize, 24) : iconSize;
        return <g key={place.id} data-kind={place.kind} data-selected={picked}
          data-muted={!!matches && !matches.has(place.id) && !picked}
          role="button" tabIndex="0" aria-label={placeTitle(place)} aria-pressed={picked} className="atlas-space"
          onClick={selectHere} onKeyDown={e=>{
            if(e.key==="Enter"||e.key===" "){e.preventDefault();skipClick.current=false;selectHere();}
          }}>
          <title>{placeTitle(place)}</title>
          {place.path ? <path d={place.path} className="atlas-cell" fillRule="evenodd"/> :
            <circle cx={px} cy={py} r={Math.max(13, iconSize * .64)} className="atlas-cell"/>}
          {place.path && <g className="atlas-walls" aria-hidden="true" pointerEvents="none">
            {roomWalls(place.path,projection.wallOffset,projection.front).map((wall,i)=><path key={i} d={wall.d} className={wall.front?"atlas-wall-face atlas-wall-front":"atlas-wall-face"}/>)}
            <path d={place.path} transform={`translate(${projection.wallOffset.join(" ")})`} className="atlas-wall-top"/>
          </g>}
          {node && place.path && <g transform={'translate('+node[0]+' '+node[1]+') rotate('+
            (Math.atan2(node[1]-py,node[0]-px)*180/Math.PI-90)+')'} className="atlas-door" aria-hidden="true">
            <path d="M-7 0H7"/><path d="M-7 0v-11q10 0 12 10"/>
          </g>}
          {!numbered && <svg x={px-symbolSize/2} y={py-(cloakroom ? symbolSize+1 : symbolSize/2)} width={symbolSize} height={symbolSize}
            viewBox="0 0 24 24" className="atlas-poi" aria-hidden="true"><path d={cloakroom ? mdiHanger : categoryIcon(place.kind)}/></svg>}
          {showNumber && <text x={px} y={py} className="atlas-number" style={{fontSize}}
            textAnchor="middle" dominantBaseline="central">{roomNumber(place)}</text>}
          {cloakroom && <text x={px} y={py+13} className="atlas-room-label" textAnchor="middle">Гардероб</text>}
        </g>;
      })}
      {floor.fixtures && <path d={floor.fixtures} className="atlas-fixtures" pointerEvents="none" aria-hidden="true"/>}
      {floor.windows && <path d={floor.windows} className="atlas-windows" pointerEvents="none" aria-hidden="true"/>}
      {route && <g className="atlas-route-line" pointerEvents="none" aria-hidden="true">
        <polyline className="atlas-route-halo" points={route.points.map(p=>p.join(",")).join(" ")}/>
        <polyline className="atlas-route-track" points={route.points.map(p=>p.join(",")).join(" ")}/>
        {arrow && <g className="atlas-route-beacon" transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle}) scale(${1/scaleOnScreen})`}>
          <circle className="atlas-beacon-halo" r="25"/><circle className="atlas-beacon-core" r="18"/>
          <path className="atlas-route-arrow" d="M-7 -9L11 0L-7 9L-3 0Z"/>
        </g>}
        {[route.points[0],route.points.at(-1)].map(([px,py],i)=><circle key={i} cx={px} cy={py} r="4.5"/>)}
      </g>}
      </g>
    </svg>
    <div className="atlas-zoom" role="group" aria-label="Управление картой">
    {showCube && <div className="atlas-cube-popover" id={cubeId} role="group" aria-label="Вращение карты"><button type="button" className="atlas-view-cube" aria-label="Вращать карту" title="Потяни прямоугольник, чтобы повернуть карту. Двойной щелчок — исходный вид."
      onPointerDown={e=>{
        if(e.button!==0)return;
        e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
        cubeDrag.current={id:e.pointerId,x:e.clientX,y:e.clientY,angle,tilt};
      }}
      onPointerMove={e=>{
        const drag=cubeDrag.current;if(!drag || drag.id!==e.pointerId)return;
        setAngle(((drag.angle+(e.clientX-drag.x)*1.3+180)%360+360)%360-180);
        setTilt(clamp(drag.tilt-(e.clientY-drag.y)*.7,15,65));
      }}
      onPointerUp={()=>{cubeDrag.current=null;}} onPointerCancel={()=>{cubeDrag.current=null;}} onLostPointerCapture={()=>{cubeDrag.current=null;}}
      onDoubleClick={()=>{setCamera(base);setAngle(-18);setTilt(42);}}
      onKeyDown={e=>{
        if(e.key==="Escape"){e.preventDefault();setShowCube(false);cubeToggle.current?.focus();return;}
        if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home"].includes(e.key))return;
        e.preventDefault();
        if(e.key==="Home"){setAngle(-18);setTilt(42);return;}
        setAngle(n=>n+(e.key==="ArrowLeft"?-8:e.key==="ArrowRight"?8:0));
        setTilt(n=>clamp(n+(e.key==="ArrowUp"?5:e.key==="ArrowDown"?-5:0),15,65));
      }}>
      <span className="atlas-cube-stage" aria-hidden="true"><span className="atlas-cube-model" style={{transform:`rotateX(${tilt}deg) rotateZ(${angle}deg)`}}>
        {["top","bottom","front","back","left","right"].map(face=><span key={face} className={"atlas-cube-face atlas-cube-"+face}/>)}
      </span><svg className="atlas-orbit-frame" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 13V7h7M27 7h7v6M34 27v6h-7M13 33H6v-6"/></svg></span>
    </button></div>}
      <button aria-label="Увеличить карту" disabled={camera.zoom>=maxZoom} onClick={()=>scale(1.4)}><Icon icon={mdiPlus}/></button>
      <button aria-label="Уменьшить карту" disabled={camera.zoom<=1} onClick={()=>scale(1/1.4)}><Icon icon={mdiMinus}/></button>
      <button type="button" ref={cubeToggle} aria-label="Управление вращением" aria-expanded={showCube} aria-controls={showCube?cubeId:undefined} onClick={()=>setShowCube(n=>!n)}><Icon icon={mdiFitToScreenOutline}/></button>
    </div>
  </div>;
}

