import {useEffect,useId,useMemo,useRef,useState} from "react";
import {MapPin,Circle,DoorOpen,ChevronRight,X} from "lucide-react";
import {findPlaces} from "./campus-map.js";

const title=entry=>[entry.place.name,entry.place.code].filter(Boolean).join(" ");
export default function RoutePlacePicker({label,value,entries,onChange}) {
  const [query,setQuery]=useState(""),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const root=useRef(null), input=useRef(null), id=useId();
  const selected=entries.find(entry=>entry.place.id===value);
  const results=useMemo(()=>{
    if(query.trim())return findPlaces(entries,query).slice(0,10);
    return [...entries].sort((a,b)=>Number(b.place.id===value)-Number(a.place.id===value) || Number(b.place.kind==="entrance")-Number(a.place.kind==="entrance")).slice(0,10);
  },[query,entries,value]);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    document.addEventListener("pointerdown",outside);
    return ()=>document.removeEventListener("pointerdown",outside);
  },[open]);
  function choose(entry) {onChange(entry);setOpen(false);setQuery("");input.current?.focus({preventScroll:true});}
  return <div className="atlas-route-field" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>{label}</label>
    <div className="atlas-route-input">{label==="Откуда" ? <Circle size={15} strokeWidth={1.8}/> : <MapPin size={16} strokeWidth={1.8}/>}
      <input id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?id+"-list":undefined} aria-activedescendant={open&&results[active]?id+"-"+active:undefined}
        autoComplete="off" placeholder={label==="Откуда" ? "Вход или аудитория" : "Куда нужно попасть"}
        value={open ? query : selected ? title(selected)+" · "+selected.building.name : ""}
        onFocus={()=>{setQuery("");setActive(0);setOpen(true);}}
        onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}}
        onKeyDown={e=>{
          if(e.nativeEvent.isComposing)return;
          if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setOpen(false);}
          if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(results.length-1,n+(e.key==="ArrowDown"?1:-1))));}
          if(e.key==="Enter" && open){e.preventDefault();if(results[active])choose(results[active]);}
        }}/>
      {selected && <button type="button" aria-label={label==="Откуда"?"Очистить точку отправления":"Очистить пункт назначения"} onClick={()=>{onChange(null);setQuery("");setOpen(false);}}><X size={15}/></button>}
    </div>
    {open && <div className="atlas-route-suggestions" id={id+"-list"} role="listbox" aria-label={label}>
      {results.map((entry,index)=><button type="button" role="option" tabIndex={-1} id={id+"-"+index} key={entry.place.id} aria-selected={selected?.place.id===entry.place.id} data-active={index===active} onPointerDown={e=>e.preventDefault()} onClick={()=>choose(entry)} onPointerMove={()=>setActive(index)}>
        {entry.place.kind==="entrance"?<DoorOpen size={18}/>:<MapPin size={18}/>}
        <span><b>{title(entry)}</b><small>{entry.building.name} · {entry.floor.name}</small></span><ChevronRight size={14}/>
      </button>)}
      {!results.length && <p role="status">Места не найдены. Попробуйте номер аудитории.</p>}
    </div>}
  </div>;
}
