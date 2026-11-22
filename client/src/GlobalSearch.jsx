import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { DoorOpen, UsersRound, BookOpen, LayoutGrid } from "lucide-react";
import { normalizeSearch, searchScore } from "../shared/search.js";
import { normalizeRoomQuery } from "../shared/booking-availability.js";
import { today } from "../shared/timetable.js";

const normalize = normalizeSearch;

function subjectsByDate(schedule, date) {
  const occurrences = Object.values(schedule || {}).flat().sort((a, b) => {
    const aPast = a.date < date;
    const bPast = b.date < date;
    const byTime = (a.date + a.time).localeCompare(b.date + b.time);
    return Number(Boolean(a.cancelled)) - Number(Boolean(b.cancelled)) ||
      Number(aPast) - Number(bPast) || (aPast ? -byTime : byTime);
  });
  const subjects = new Map();
  for (const lesson of occurrences) {
    if (!subjects.has(lesson.name)) subjects.set(lesson.name, lesson);
  }
  return [...subjects.values()];
}

export default function GlobalSearch({ people, schedule, services, rooms, onPerson, onLesson, onRoom, onService }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [semantic, setSemantic] = useState({query:"",scores:[],status:"idle"});
  const worker = useRef(null), requestId = useRef(0);
  const root = useRef(null), input = useRef(null);
  const pointerHeld = useRef(false), deferredSemantic = useRef(null);
  const q = normalize(query);
  const resultsOpen = expanded && Boolean(q);
  const roomQuery = /^[бbнhn][\s‐‑–—-]*\d+[\p{L}]?$/iu.test(query.trim());
  const roomCode = roomQuery ? normalizeRoomQuery(query) : "";
  const synonyms = /математ/.test(q) ? value => /алгебр|геометр|математ|статист|анализ/.test(value) : null;
  const currentDate = today();
  const lessons = useMemo(() => subjectsByDate(schedule, currentDate), [schedule, currentDate]);
  const documentKey = JSON.stringify([
    ...lessons.map(e=>({id:`lesson:${e.name}`,text:`Учебный предмет ${e.name} ${e.type}`})),
    ...services.map(s=>({id:`service:${s[3]}`,text:`${s[1]}. ${s[2]}`})),
  ]);
  const documents = useMemo(()=>JSON.parse(documentKey),[documentKey]);
  useEffect(()=>()=>worker.current?.terminate(),[]);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !resultsOpen) return;
    const list = root.current.querySelector(".search-results");
    function fitResults() {
      const bottom = viewport.offsetTop + viewport.height;
      list.style.setProperty("--search-visible-height", Math.max(0, bottom - list.getBoundingClientRect().top - 8) + "px");
    }
    fitResults();
    viewport.addEventListener("resize", fitResults);
    viewport.addEventListener("scroll", fitResults);
    return () => {
      viewport.removeEventListener("resize", fitResults);
      viewport.removeEventListener("scroll", fitResults);
    };
  }, [resultsOpen]);
  useEffect(() => {
    let frame;
    function release() {
      if (!pointerHeld.current) return;
      pointerHeld.current = false;
      frame = requestAnimationFrame(() => {
        if (pointerHeld.current || !deferredSemantic.current) return;
        setSemantic(deferredSemantic.current);
        deferredSemantic.current = null;
      });
    }
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, []);
  useEffect(() => {
    if (!expanded) return;
    function dismissOutside(event) {
      if (!root.current?.contains(event.target)) setExpanded(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [expanded]);
  useEffect(()=>{
    const id=++requestId.current;
    if(!expanded || q.length<3 || roomQuery) return;
    let active=true;
    function publish(result) {
      if (pointerHeld.current) deferredSemantic.current = result;
      else setSemantic(result);
    }
    const timer=setTimeout(()=>{
      publish({query:q,scores:[],status:"loading"});
      worker.current ||= new Worker(new URL('./search.worker.js',import.meta.url),{type:'module'});
      worker.current.onmessage=({data})=>{
        if(active && data.id===requestId.current) publish({query:q,scores:data.scores || [],status:data.error?'error':'ready'});
      };
      worker.current.onerror=()=>{if(active)publish({query:q,scores:[],status:'error'});};
      worker.current.postMessage({id,query:q,documents});
    },350);
    return ()=>{active=false;clearTimeout(timer);};
  },[q,expanded,documents,roomQuery]);
  const semanticScore = id => semantic.query===q ? (semantic.scores.find(s=>s.id===id)?.score || 0) : 0;
  const rank = (items, text, names=false) => items.map(item=>({item,score:searchScore(q,text(item),{names})})).filter(r=>r.score).sort((a,b)=>b.score-a.score).map(r=>r.item);
  const groups = q ? [
    {name:"Аудитории", Icon:DoorOpen, results:(roomQuery
      ? rooms.filter(r=>normalizeRoomQuery(r.short).startsWith(roomCode)).sort((a,b)=>Number(normalizeRoomQuery(b.short)===roomCode)-Number(normalizeRoomQuery(a.short)===roomCode))
      : rank(rooms,r=>`${r.short} ${r.name}`)).map(r => ({label:r.short,detail:r.name || "Аудитория",run:() => onRoom(r.short)}))},
    {name:"Люди", Icon:UsersRound, results:rank(Object.entries(people),([id,p])=>`${p.name} ${id} ${p.number}`,true).map(([id,p]) => ({label:p.name,detail:p.number || id,run:() => onPerson(id)}))},
    {name:"Предметы", Icon:BookOpen, results:lessons.map(e=>({e,score:searchScore(q,e.name) || (synonyms && synonyms(normalize(e.name)) ? 70 : 0) || (semanticScore(`lesson:${e.name}`)>=.48 ? semanticScore(`lesson:${e.name}`)*50 : 0)})).filter(r=>r.score).sort((a,b)=>b.score-a.score).map(({e}) => ({label:e.name,detail:e.type,run:() => onLesson(e)}))},
    {name:"Сервисы", Icon:LayoutGrid, results:services.map(s=>({s,score:searchScore(q,`${s[1]} ${s[2]}`) || (semanticScore(`service:${s[3]}`)>=.48 ? semanticScore(`service:${s[3]}`)*50 : 0)})).filter(r=>r.score).sort((a,b)=>b.score-a.score).map(({s}) => ({label:s[1],detail:s[2],run:() => onService(s[3])}))},
  ].filter(group => group.results.length && (!roomQuery || group.Icon === DoorOpen)) : [];
  function select(result) {
    input.current?.blur();
    setExpanded(false);
    setQuery("");
    result.run();
  }

  return <div className="global-search" ref={root} data-search-open={expanded && Boolean(q)}
    onPointerDownCapture={event => {
      if (event.target.closest(".search-results button")) pointerHeld.current = true;
    }}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
    }}
    onKeyDown={event => {
      if (q && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        const options = [...root.current.querySelectorAll(".search-results button")];
        const current = options.indexOf(document.activeElement);
        if (options.length || !expanded && event.key === "ArrowDown") {
          event.preventDefault();
          if (!expanded) setExpanded(true);
          else if (event.key === "ArrowDown") options[Math.min(current + 1, options.length - 1)]?.focus();
          else (options[current - 1] || input.current)?.focus();
        }
        return;
      }
      if (event.key !== "Escape" || !expanded) return;
      event.preventDefault();
      input.current?.focus({ preventScroll: true });
      setExpanded(false);
    }}>
    <input ref={input} type="search" aria-label="Поиск по деканату" aria-expanded={expanded && Boolean(q)} aria-controls={expanded && q ? "campus-search-results" : undefined} placeholder="Поиск" value={query} onClick={() => setExpanded(true)} onFocus={() => setExpanded(true)} onChange={e => {setQuery(e.target.value);setExpanded(true);}} />
    {expanded && q && <div id="campus-search-results" className="search-results" aria-label="Результаты поиска">
      {!groups.length && !(semantic.query===q && semantic.status==='loading') && <p>Ничего не найдено</p>}
      {groups.map(({name,Icon,results}) => <section className="search-group" key={name} aria-label={name}>
        <h2 className="search-group-title">{name}</h2>
        {results.slice(0,8).map(r => <button type="button" key={r.detail + r.label} title={`${r.label} · ${r.detail}`} onClick={() => select(r)}>
          <span className="search-result-icon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="search-result-copy"><span className="search-result-name">{r.label}</span><small>{r.detail}</small></span>
        </button>)}
      </section>)}
      {semantic.query===q && semantic.status==='loading' && <p className="search-semantic-status" role="status">Ищу также по смыслу…</p>}
      {semantic.query===q && semantic.status==='error' && <p className="search-semantic-status">Поиск по смыслу недоступен. Поиск по названиям работает.</p>}
    </div>}
  </div>;
}
