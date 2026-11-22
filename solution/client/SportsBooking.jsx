import {useEffect,useRef,useState} from 'react';
import {MapPin,Clock3,UsersRound,CalendarDays,ArrowRight,Check,Info} from 'lucide-react';
import {gym,gymSeatsLeft,numberTime,timeText} from '../shared/campus-data.js';
import {today,offset,printDate,overlaps} from '../shared/timetable.js';
import AccountSelect from './AccountSelect.jsx';
import SportSymbol from './SportSymbol.jsx';
import {sportSlots,sportSeatsLeft,nextSportDate} from '../shared/sports.js';
import {bookingDurations,bookingDurationLabel as durationLabel} from '../shared/booking-availability.js';
import {useImageReady} from './image-ready.js';
import './sports-booking.css';

const lastDate='2026-12-28';
const plural=new Intl.PluralRules('ru');
const places=n=>`${n} ${{one:'место',few:'места',many:'мест',other:'места'}[plural.select(n)]}`;
const periods=[['Утро',540,720],['День',720,1020],['Вечер',1020,1320]];

export default function SportsBooking({activity,initial,reservations=[],schedule={},busy,onNavigate,onSend,showImage=true}) {
  const venue=activity ? {short:activity.short,capacity:activity.capacity,building:{name:activity.venue},floorName:"Спортивный центр"}:gym;
  const {pending,imageProps}=useImageReady(showImage ? import.meta.env.BASE_URL+'services/sports.png' : null);
  const initialDate=initial?.date >= today() && initial.date <= lastDate ? initial.date : today();
  const firstActivityDate=() => {
    const next=activity && nextSportDate(activity,initialDate);
    return next && next <= lastDate ? next : initialDate;
  };
  const [local,setLocal]=useState(() => ({date:firstActivityDate(),duration:activity?.duration || 60,start:initial?.start}));
  const selection=onNavigate ? initial || {} : local;
  const date=selection.date || today();
  const duration=activity?.duration || (bookingDurations.includes(selection.duration) ? selection.duration : 60);
  const start=selection.start ? numberTime(selection.start) : null;
  const dateStrip=useRef(null);
  useEffect(()=>{
    const strip=dateStrip.current,selected=strip?.querySelector('[aria-pressed=true]');
    if(selected)strip.scrollTo({left:selected.offsetLeft-(strip.clientWidth-selected.clientWidth)/2,behavior:'instant'});
  },[date]);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const validDate=date>=today() && date<=lastDate;
  const slots=activity ? sportSlots(activity,date) : Array.from({length:26},(_,i)=>540+i*30).filter(t=>t+duration<=1320);
  const nextDate=activity && validDate && !slots.length ? nextSportDate(activity,date) : null;
  const seats=t=>activity?sportSeatsLeft(activity,date,t,reservations):gymSeatsLeft(date,t,t+duration,reservations);
  const request=start===null?null:{kind:'booking',short:venue.short,...(activity?{sport:activity.id}:{}),date,time:timeText(start),end:timeText(start+duration)};
  const free=request && validDate && slots.includes(start)?seats(start):0;
  const personal=request && (schedule[date] || []).find(e=>overlaps(e,request));
  const canSend=Boolean(free && !busy && !sending);
  const dates=Array.from({length:7},(_,i)=>offset(today(),i)).filter(d=>d<=lastDate);
  function select(changes){
    setError("");
    if (onNavigate) onNavigate(changes,"replace");
    else setLocal(current=>({...current,...changes}));
  }
  function chooseDate(value){if(value || !onNavigate) select({date:value,start:""});}
  async function submit(e){
    e.preventDefault();if(!canSend)return;
    setSending(true);
    setError("");
    try { await onSend?.(request, { throwOnError:true }); }
    catch (failure) { setError(failure.message); }
    finally { setSending(false); }
  }
  return <section className="sports-booking" aria-label={activity?"Запись: "+activity.name:"Запись в спортзал"}>
    <article className="sports-overview" data-image-pending={pending || undefined} aria-busy={pending || undefined}>
      {showImage && <span className="sports-overview-photo image-skeleton-block"><img {...imageProps} alt=""/></span>}
      <div className="sports-overview-copy">
        <span className="sports-eyebrow"><SportSymbol className="image-skeleton-icon" sport={activity} size={17}/><span className="image-skeleton-text">Спорт в кампусе</span></span>
        <h2><span className="image-skeleton-text">{activity?.name || "Время для себя"}</span></h2>
        <p><span className="image-skeleton-text">{activity?.description || "Выбери удобное время для самостоятельной тренировки."}</span></p>
        <div className="sports-facts">
          <span><MapPin className="image-skeleton-icon" size={15}/><span className="image-skeleton-text">{venue.building.name} · {venue.short}</span></span>
          <span><Clock3 className="image-skeleton-icon" size={15}/><span className="image-skeleton-text">{activity?durationLabel(duration):"09:00–22:00"}</span></span>
          <span><UsersRound className="image-skeleton-icon" size={15}/><span className="image-skeleton-text">До {places(venue.capacity)}</span></span>
        </div>
      </div>
    </article>
    <div className="sports-layout">
      <section className="sports-picker" aria-label="Выбор времени тренировки">
        <div className="sports-section-title"><CalendarDays size={19}/><h2>Когда пойдём?</h2></div>
        <div className="sports-date-controls"><label>Дата<input type="date" aria-label="Дата тренировки" min={today()} max={lastDate} value={date} onChange={e=>chooseDate(e.target.value)}/></label>
          {activity?<div className="sports-fixed-duration"><span>Длительность</span><b>{durationLabel(duration)}</b></div>:<AccountSelect label="Длительность" value={String(duration)} options={bookingDurations.map(n=>({value:String(n),label:durationLabel(n)}))} onChange={v=>select({duration:Number(v),start:""})}/>}
        </div>
        <div className="sports-dates" ref={dateStrip} role="group" aria-label="Ближайшие дни">{dates.map((d,i)=><button key={d} type="button" aria-pressed={date===d} onClick={()=>chooseDate(d)}><span>{i===0?'Сегодня':i===1?'Завтра':printDate(d,{weekday:'short'})}</span><b>{printDate(d,{day:'numeric',month:'short'})}</b></button>)}</div>
        <div className="sports-slots-heading"><h3>Начало тренировки</h3><span>Время по Москве</span></div>
        <p className="sports-caption">Под временем — свободные места на всю тренировку.</p>
        {!validDate?<p className="sports-empty" role="status">Выбери дату с {printDate(today(),{day:'numeric',month:'long'})} по 28 декабря.</p>:
          !slots.length?<p className="sports-empty" role="status">В этот день занятий нет. {nextDate && nextDate<=lastDate
            ? <button type="button" className="text-link" onClick={()=>chooseDate(nextDate)}>Выбрать ближайшее занятие</button>
            : "До конца периода занятий по этому направлению больше нет."}</p>:<div className="sports-periods">{periods.map(([label,from,to])=>{
            const times=slots.filter(t=>t>=from && t<to);if(!times.length)return null;
            return <div className="sports-period" key={label}><h4>{label}</h4><div className="sports-slots">{times.map(t=>{
              const left=seats(t);return <button type="button" key={t} aria-pressed={start===t} disabled={!left || busy || sending} aria-label={`${timeText(t)} · ${left?places(left)+' свободно':'Мест нет'}`} onClick={()=>select({start:timeText(t)})}>
                <b>{timeText(t)}</b><small>{left?places(left):'Мест нет'}</small>{start===t && <Check size={13} aria-hidden="true"/>}
              </button>;
            })}</div></div>;
          })}</div>}
      </section>
      <aside className="sports-summary" aria-label="Твоя тренировка"><span className="sports-summary-icon"><SportSymbol sport={activity} size={25} strokeWidth={1.8}/></span><h2>Твоя тренировка</h2>
        {!request || !validDate?<p className="sports-summary-empty">Выбери время — здесь появятся детали записи.</p>:<div className="sports-selection" aria-live="polite"><p>{printDate(date,{weekday:'long',day:'numeric',month:'long'})}</p><strong>{request.time}<span>—</span>{request.end}</strong><small>{durationLabel(duration)} · 1 место</small></div>}
        <dl><div><dt>Где</dt><dd>{venue.building.name}</dd></div><div><dt>Формат</dt><dd>{activity?"Занятие в секции":"Самостоятельно"}</dd></div>{request && validDate && <div><dt>Свободно</dt><dd>{places(free)} из {venue.capacity}</dd></div>}</dl>
        {personal && <p className="sports-conflict"><Info size={16}/><span>В это время у тебя «{personal.name}»{personal.room ? " в аудитории " + personal.room : ""}, но заявку всё равно можно отправить.</span></p>}
        {error && <p className="sports-conflict" role="alert"><Info size={16}/><span>{error}</span></p>}
        <form onSubmit={submit}><button className="sports-submit" disabled={!canSend}>{busy || sending?'Отправляем…':'Отправить заявку'}<ArrowRight size={17}/></button></form>
        {activity && <p className="sports-bring"><Info size={15}/><span>{activity.bring}</span></p>}
        <p className="sports-approval">Запись подтвердит деканат. Статус появится в «Моих заявках».</p>
      </aside>
    </div>
  </section>;
}
