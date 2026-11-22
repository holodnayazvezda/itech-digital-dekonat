import { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { MapPin, UsersRound, Monitor, ArrowLeft, Search, DoorOpen, Check } from 'lucide-react';
import { rooms, roomBuildings, roomFund, roomActivities, numberTime, timeText } from '../../shared/domain/campus-data.js';
import { today, offset, printDate, overlaps } from '../../shared/domain/timetable.js';
import { availableRoomStarts, bookingDurations, bookingDurationLabel, normalizeRoomQuery } from '../../shared/domain/booking-availability.js';
import AccountSelect from '../../shared/ui/AccountSelect.jsx';
import { useImageReady, useImagesReady, useRouteImages } from '../../shared/ui/image-ready.js';
import './space-booking.css';
const campuses = [...roomBuildings].sort((a, b) => a.name.localeCompare(b.name));
const campusPhotos = campuses.map(campus => import.meta.env.BASE_URL + campus.image);
const roomImage = room => room.kind === 'Переговорная' ? 'room-meeting.png' : room.name.startsWith('Студия') ? 'room-studio.png' : 'room-project.png';
const servicePhoto = name => import.meta.env.BASE_URL + 'services/' + name;
const normalize = normalizeRoomQuery;
const timePeriods = [{
  id: 'morning',
  label: 'Утро',
  from: 540,
  to: 720
}, {
  id: 'day',
  label: 'День',
  from: 720,
  to: 1080
}, {
  id: 'evening',
  label: 'Вечер',
  from: 1080,
  to: 1320
}];
function bookingStart(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value ?? '') ? numberTime(value) : null;
}
function RoomFacts({
  room,
  detail = false
}) {
  const size = detail ? 15 : 14;
  const equipment = room.meta.split(' · ').slice(1).join(' · ');
  return <span className="space-room-facts">
    <span><UsersRound className="image-skeleton-icon" size={size} /><span className="image-skeleton-text">{room.capacity} мест</span></span>
    <span><Monitor className="image-skeleton-icon" size={size} /><span className="image-skeleton-text">{detail ? equipment : equipment || 'Для занятий'}</span></span>
  </span>;
}
function SpaceRoomCard({
  room,
  hasPhoto,
  onChoose
}) {
  const {
    pending,
    imageProps
  } = useImageReady(hasPhoto ? servicePhoto(roomImage(room)) : null);
  return <button className="space-room-card" onClick={() => onChoose(room.short)} data-image-pending={pending || undefined} aria-busy={pending || undefined} disabled={pending}>
    {hasPhoto ? <span className="space-booking-photo image-skeleton-block"><img {...imageProps} alt="" loading="lazy" /></span> : <div className="space-classroom-art"><DoorOpen size={42} strokeWidth={1.2} /><span>{room.short}</span></div>}
    <div>
      <strong><span className="image-skeleton-text">{room.name}</span></strong>
      <small><span className="image-skeleton-text">{room.floorName}</span></small>
      <RoomFacts room={room} />
    </div>
  </button>;
}
export default function SpaceBooking(props) {
  const room = rooms.find(r => r.short === props.initial?.short && roomFund(r) !== 'Спортзал');
  useRouteImages(room ? [servicePhoto(roomFund(room) === 'Коворкинги' ? roomImage(room) : 'booking-room.png')] : props.initial?.building ? [] : campusPhotos);
  return <SpaceBookingForm {...props} />;
}
function SpaceBookingForm(props) {
  const [local, setLocal] = useState(props.initial || {});
  const route = props.onNavigate ? props.initial || {} : local;
  const selected = route.short || '';
  const room = rooms.find(r => r.short === selected && roomFund(r) !== 'Спортзал');
  const campus = campuses.find(b => b.name === (room?.building.name || route.building));
  const building = campus?.name || '';
  const fund = room ? roomFund(room) : route.fund || 'Коворкинги';
  const date = route.date || today();
  const duration = bookingDurations.includes(route.duration) ? route.duration : 60;
  const start = bookingStart(route.start);
  const [preferredPeriod, setPeriod] = useState('morning');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const root = useRef(null),
    pendingScroll = useRef(null),
    roomListScroll = useRef(0);
  const {
    pending: campusesPending,
    imageProps: campusImageProps
  } = useImagesReady(building ? [] : campusPhotos);
  const {
    pending: roomPending,
    imageProps: roomImageProps
  } = useImageReady(room ? servicePhoto(fund === 'Коворкинги' ? roomImage(room) : 'booking-room.png') : null);
  const validDate = date >= today() && date <= '2026-12-28';
  const items = useMemo(() => rooms.filter(r => r.building.name === building && roomFund(r) === fund && normalize(r.name + ' ' + r.meta).includes(normalize(query))), [building, fund, query]);
  const occupied = useMemo(() => validDate ? [...roomActivities(date, props.lessonChanges), ...props.reservations.filter(r => r.date === date)] : [], [date, validDate, props.reservations, props.lessonChanges]);
  const starts = useMemo(() => availableRoomStarts(occupied, selected, Number(duration)), [occupied, selected, duration]);
  const periods = timePeriods.map(p => ({
    ...p,
    starts: starts.filter(t => t >= p.from && t < p.to)
  }));
  const activePeriod = periods.find(p => p.starts.includes(start)) || periods.find(p => p.id === preferredPeriod && p.starts.length) || periods.find(p => p.starts.length);
  const chosenStart = validDate && starts.includes(start) ? start : null;
  const request = chosenStart === null ? null : {
    kind: 'booking',
    short: selected,
    date,
    time: timeText(chosenStart),
    end: timeText(chosenStart + Number(duration))
  };
  const canSend = request !== null && !props.busy;
  const personal = request && (props.schedule?.[date] || []).find(e => overlaps(e, request));
  function revealStep() {
    const top = root.current.getBoundingClientRect().top + window.scrollY;
    const header = document.querySelector('.shell .rail');
    const pinned = header && ['sticky', 'fixed'].includes(getComputedStyle(header).position) ? header.getBoundingClientRect().height : 0;
    return Math.max(0, top - pinned - 16);
  }
  function navigate(changes, transition = "replace") {
    if (props.onNavigate) props.onNavigate(changes, transition);else setLocal(current => ({
      ...current,
      ...changes
    }));
  }
  function chooseBuilding(value) {
    pendingScroll.current = revealStep();
    navigate({
      building: value,
      short: ''
    }, "push");
    setQuery('');
    setLimit(12);
  }
  function chooseRoom(value) {
    roomListScroll.current = window.scrollY;
    pendingScroll.current = revealStep();
    navigate({
      short: value,
      building,
      fund
    }, "push");
  }
  function returnToRooms() {
    pendingScroll.current = roomListScroll.current;
    navigate({
      short: '',
      building,
      fund,
      start: ''
    }, "back");
  }
  function returnToBuildings() {
    navigate({
      short: '',
      building: '',
      fund: '',
      start: ''
    }, "buildings");
  }
  function chooseDate(value) {
    if (value) navigate({
      date: value,
      start: ''
    });
  }
  useLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    const top = pendingScroll.current;
    pendingScroll.current = null;
    const restore = () => window.scrollTo({
      top,
      behavior: 'instant'
    });
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [building, selected]);
  const quickDates = Array.from({
    length: 7
  }, (_, i) => offset(today(), i));
  return <section className="space-booking" ref={root}>
    {!building ? <>
      <div className="space-heading"><h2>Выберите корпус</h2><p>Найдите место для встречи, работы или учёбы.</p></div>
      <div className="space-buildings" data-image-pending={campusesPending || undefined} aria-busy={campusesPending || undefined}>
        {campuses.map((b, index) => <button key={b.name} onClick={() => chooseBuilding(b.name)} disabled={campusesPending}>
          <span className="space-booking-photo image-skeleton-block"><img {...campusImageProps[index]} alt={b.alt} /></span>
          <span className="space-building-copy">
            <strong><span className="image-skeleton-text">{b.name}</span></strong>
            <small><MapPin className="image-skeleton-icon" size={13} /><span className="image-skeleton-text">{b.address}</span></small>
          </span>
      </button>)}</div>
    </> : <>
      <div className="space-location"><button onClick={returnToBuildings}><ArrowLeft size={15} />Корпуса</button><span>{campus.name}</span><small><MapPin size={13} />{campus.address}</small></div>
      {!room ? <>
        <div className="space-catalog-toolbar"><div className="space-fund-tabs" role="group" aria-label="Тип помещения">{['Коворкинги', 'Аудиторный фонд'].map(f => <button key={f} aria-pressed={fund === f} onClick={() => {
              navigate({
                fund: f
              });
              setQuery('');
              setLimit(12);
            }}>{f === 'Аудиторный фонд' ? 'Аудитории' : f}</button>)}</div>
          <label className="space-search"><Search size={16} /><input type="search" aria-label="Поиск помещения" placeholder="Номер или название" value={query} onChange={e => {
              setQuery(e.target.value);
              setLimit(12);
            }} /></label>
        </div>
        <div className="space-heading"><h2>{fund === 'Коворкинги' ? 'Место для вашей идеи' : 'Учебные аудитории'}</h2><p>{items.length} помещений · выберите подходящее</p></div>
        <div className="space-room-grid">{items.slice(0, limit).map(r => <SpaceRoomCard key={r.short} room={r} hasPhoto={fund === 'Коворкинги'} onChoose={chooseRoom} />)}</div>
        {!items.length && <p className="space-empty">Помещений не найдено. Попробуйте другой номер.</p>}
        {items.length > limit && <button className="space-more" onClick={() => setLimit(limit + 12)}>Показать ещё</button>}
      </> : <>
        <button className="space-change-room" onClick={returnToRooms}><ArrowLeft size={14} />Все помещения</button>
        <div className="space-reservation">
          <article className="space-room-overview" data-image-pending={roomPending || undefined} aria-busy={roomPending || undefined}>
            <span className="space-booking-photo image-skeleton-block"><img {...roomImageProps} alt="" /></span>
            <div>
              <h2><span className="image-skeleton-text">{room.name}</span></h2>
              <p><MapPin className="image-skeleton-icon" size={14} /><span className="image-skeleton-text">{campus.name} · {room.floorName}</span></p>
              <RoomFacts room={room} detail />
            </div>
          </article>
          <section className="space-time-picker" aria-label="Выбор времени бронирования">
            <h2>Когда вам удобно?</h2>
            <div className="space-date-controls"><label>Дата<input type="date" aria-label="Дата бронирования" min={today()} max="2026-12-28" value={date} onChange={e => chooseDate(e.target.value)} /></label>
              <AccountSelect label="Длительность" value={String(duration)} onChange={v => navigate({
                duration: Number(v),
                start: ''
              })} options={bookingDurations.map(v => ({
                value: String(v),
                label: bookingDurationLabel(v)
              }))} />
            </div>
            <div className="space-date-pills" aria-label="Ближайшие даты">{quickDates.map(d => <button key={d} aria-pressed={d === date} onClick={() => chooseDate(d)}>{d === today() ? 'Сегодня' : printDate(d, {
                  weekday: 'short',
                  day: 'numeric'
                })}</button>)}</div>
            <h3>Свободное время</h3><p className="space-slot-caption">Выберите готовый интервал · время по Москве</p>
            {!validDate ? <p className="space-empty">Выберите дату с 20 ноября по 28 декабря.</p> : !starts.length ? <p className="space-empty">На эту длительность свободных интервалов нет. Выберите другую дату или сократите время.</p> : <>
              <div className="space-time-periods" role="group" aria-label="Часть дня">{periods.map(p => <button key={p.id} aria-pressed={activePeriod?.id === p.id} disabled={!p.starts.length} onClick={() => {
                  setPeriod(p.id);
                  navigate({
                    start: ''
                  });
                }}>{p.label}<small aria-hidden="true">{p.starts.length}</small></button>)}</div>
              <div className="space-time-slots" key={activePeriod?.id}>{activePeriod?.starts.map(t => <button key={t} aria-label={`${timeText(t)} — ${timeText(t + duration)}`} aria-pressed={chosenStart === t} onClick={() => navigate({
                  start: timeText(t)
                })}><strong>{timeText(t)}</strong><small>до {timeText(t + duration)}</small>{chosenStart === t && <Check size={13} aria-hidden="true" />}</button>)}</div>
            </>}
            <div className="space-booking-summary" aria-live="polite"><span>{printDate(date || today(), {
                  day: 'numeric',
                  month: 'long'
                })}</span><strong>{request ? `${request.time} — ${request.end}` : 'Выберите интервал'}</strong></div>
            {personal && <p className="space-personal-note">В это время у вас «{personal.name}»{personal.room ? " в аудитории " + personal.room : ""}, но заявку всё равно можно отправить.</p>}
            <button className="space-submit" disabled={!canSend} onClick={() => {
              if (canSend) props.onSend?.(request);
            }}>{props.busy ? 'Отправляем…' : 'Отправить заявку'}</button>
            <p className="space-booking-note">Бронь появится после согласования деканата.</p>
          </section>
        </div>
      </>}
    </>}
  </section>;
}
