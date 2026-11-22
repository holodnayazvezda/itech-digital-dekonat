import { buildings, moveIn, currentMoveIn, moveInStatus } from "../shared/residences.js";
import { services } from "../shared/services.js";
import { today } from "../shared/timetable.js";
import RequestList from "./RequestList.jsx";
import { Building2, DoorOpen, MapPin, ChevronRight, Wrench, MessageCircle, CalendarDays, ReceiptText, Clock3, Phone } from 'lucide-react';
import './housing.css';

const housingServices = services.filter(service => service.group === "housing");
const rubles = value => value.toLocaleString("ru-RU") + " ₽";
const dateLabel = (iso, options = { day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

function HouseMark({ park }) {
  return <Building2 className="house-mark" size={24} strokeWidth={1.5} aria-hidden="true"/>;
}

function BuildingLink({ building, account, onGo }) {
  if(account) return <button className="housing-building is-home" onClick={()=>onGo('residence',building.id)}>
    <div className="housing-home-top"><span>Проживание</span><HouseMark/></div>
    <div className="housing-building-copy"><strong>{building.short}</strong><span><MapPin size={13}/>{building.address}</span></div>
    <div className="housing-room-number"><DoorOpen size={18}/><span>Комната<strong>{account.room || 'Уточняется'}</strong></span></div>
    <div className="housing-home-footer"><small><CalendarDays size={13}/>{account.start > today() ? 'Заселение с ' : 'Проживание с '}{dateLabel(account.start,{day:'numeric',month:'long',year:'numeric'})}</small><ChevronRight size={16}/></div>
  </button>;
  return <button className={'housing-building' + (account ? ' is-home' : '')}
    onClick={() => onGo("residence", building.id)}>
    <HouseMark park={building.id === "park"} />
    <span className="housing-building-copy">
      <strong>{building.short}</strong>
      <span>{account?.room ? "Комната " + account.room : building.address}</span>
      {account && <small>{account.start > today() ? "Заселение с " : "С "}{dateLabel(account.start)}</small>}
    </span>
    <ChevronRight className="housing-arrow" size={17} aria-hidden="true"/>
  </button>;
}

export function ResidenceDetails({ id }) {
  const building = buildings.find(item => item.id === id);
  if (!building) return <p>Общежитие не найдено.</p>;
  return <div className="housing-page housing-redesign housing-detail">
    <section className="housing-address">
      <HouseMark park={id === "park"} />
      <div><h2>{building.name}</h2><p>{building.address}</p>
        <a href={"https://yandex.ru/maps/213/moscow/?text=" + encodeURIComponent(building.address)}
          target="_blank" rel="noopener noreferrer"><MapPin size={13}/>Открыть на карте</a>
      </div>
    </section>
    <div className="housing-columns">
      <section><h2><Phone size={16}/>Комендант</h2><div className="housing-facts">
        <strong>{building.commandant}</strong>
        <dl><dt>Телефон коменданта · демо</dt><dd><a href={"tel:" + building.phone.replace(/[^+\d]/g, "")}>{building.phone}</a><br />Внутренний {building.extension}</dd>
          <dt>Приём</dt><dd>Кабинет {building.office}<br />{building.hours}</dd></dl>
      </div></section>
      <section><h2><DoorOpen size={16}/>Полезные помещения</h2><dl className="housing-facts">
        <dt>Дежурный администратор</dt><dd>{building.reception}</dd>
        <dt>Прачечная</dt><dd>{building.laundry}</dd>
      </dl></section>
    </div>
  </div>;
}

function RentLedger({ charges = [] }) {
  const rows = [...charges].sort((a, b) => b.due.localeCompare(a.due));
  const open = rows.filter(row => row.paid < row.amount);
  const balance = open.reduce((sum, row) => sum + row.amount - row.paid, 0);
  const next = open.at(-1);
  return <section className="rent-ledger" aria-label="Оплата проживания">
    <h2>Оплата проживания</h2>
    {rows.length ? <>
      <div className="housing-balance"><div className="housing-payment-top"><span>К оплате</span><ReceiptText size={20} strokeWidth={1.5}/></div><strong>{rubles(balance)}</strong>
        <span className="housing-due" data-overdue={Boolean(next && next.due<today())}><Clock3 size={13}/>{next ? (next.due < today() ? "Срок истёк " : "Внести до ") + dateLabel(next.due, {day:"numeric", month:"long"}) : "Всё оплачено"}</span>
      </div>
      <details><summary>История начислений и оплат</summary>
        {rows.map(row => <article className="rent-row" key={row.due}>
          <div><strong>{dateLabel(row.due, {month:"long", year:"numeric"})}</strong>
            <span>{row.paid >= row.amount ? "Оплачено" : row.paid ? "Частично оплачено" : "Ожидает оплаты"}</span></div>
          <p>Начислено {rubles(row.amount)} · внесено {rubles(row.paid)}</p>
          {row.posted && <small>Последнее зачисление {dateLabel(row.posted)}</small>}
        </article>)}
      </details>
    </> : <p>Начислений за проживание пока нет.</p>}
  </section>;
}

export default function HousingView({ account, student, records, onGo, onRequest, onRecord }) {
  const home = buildings.find(item => item.name === account?.building);
  const history = records.filter(r => housingServices.some(service => service.name === r.name));
  const pending = currentMoveIn(history);
  const others = buildings.filter(building => building !== home);
  return <div className="housing-page housing-redesign">
    {student && <div className={'housing-columns housing-top'+(!account?' housing-top-single':'')}>
      <section><h2>Моё общежитие</h2>
        {home ? <BuildingLink building={home} account={account} onGo={onGo} /> :
          <div className="housing-facts housing-no-home"><Building2 size={28} strokeWidth={1.4}/><strong>{pending ? moveInStatus(pending) : "Место пока не назначено"}</strong>
            {pending ? <button className="text-link" onClick={() => onRecord(pending)}>Посмотреть заявку →</button> :
              <button className="housing-move-in" onClick={() => onRequest(moveIn)}>Подать заявление на заселение</button>}</div>}
      </section>
      {account && <RentLedger charges={account.charges} />}
    </div>}
    {student && <div className="housing-columns">
      <section aria-labelledby="housing-services"><h2 id="housing-services">Обращения в общежитие</h2>
        <div className="housing-actions">{housingServices.filter(s => s.name !== moveIn).map(s =>
          <button key={s.name} onClick={() => onRequest(s.name)}>{s.name.includes('ремонт')?<Wrench size={20} strokeWidth={1.5}/>:<MessageCircle size={20} strokeWidth={1.5}/>}<span><strong>{s.name.includes('ремонт')?'Заявка на ремонт':'Поддержка общежития'}</strong><small>{s.name.includes('ремонт')?'Сообщить о неисправности':'Задать вопрос о проживании'}</small></span><ChevronRight size={16}/></button>)}</div>
      </section>
      <section aria-labelledby="housing-history"><h2 id="housing-history">Мои обращения</h2>
        {history.length ? <RequestList records={history} onSelect={onRecord} /> : <div className="housing-empty"><MessageCircle size={22} strokeWidth={1.5}/><strong>Обращений пока нет</strong><p>Здесь появятся ответы и статусы ваших заявок.</p></div>}
      </section>
    </div>}
    <section><h2>{home ? "Другие общежития" : "Общежития кампуса"}</h2>
      <div className="housing-buildings">{others.map(building => <BuildingLink key={building.id} building={building} onGo={onGo} />)}</div>
    </section>
  </div>;
}
