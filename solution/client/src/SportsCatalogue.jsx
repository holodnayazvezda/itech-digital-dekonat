import { useRef, useState } from "react";
import { ArrowUpRight, Clock3, Dumbbell, MapPin, Search, X } from "lucide-react";
import { sports, sportCategories } from "../shared/sports.js";
import { Dialog } from "./ui.jsx";
import SportsBooking from "./SportsBooking.jsx";
import SportSymbol from "./SportSymbol.jsx";
import "./sports-booking.css";

const weekdays = { 1: "пн", 2: "вт", 3: "ср", 4: "чт", 5: "пт", 6: "сб", 7: "вс" };
const allCategories = "Все";
const categories = [allCategories, ...sportCategories];
const fold = value => value.toLocaleLowerCase("ru").replaceAll("ё", "е");

export default function SportsCatalogue({ onSend, ...bookingProps }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(allCategories);
  const [selected, setSelected] = useState(null);
  const activeCard = useRef(null);
  const term = fold(query.trim());
  const items = sports.filter(sport =>
    (category === allCategories || sport.category === category) &&
    fold([sport.name, sport.venue, sport.category].join(" ")).includes(term)
  );

  function close() {
    setSelected(null);
    requestAnimationFrame(() => activeCard.current?.focus({ preventScroll: true }));
  }

  async function sendRequest(request, options) {
    const result = await onSend?.(request, options);
    if (result) setSelected(null);
    return result;
  }

  return (
    <section className="sports-catalogue" aria-label="Виды спорта">
      <div className="sports-catalogue-intro">
        <div>
          <span className="sports-eyebrow">Движение в твоём ритме</span>
          <h2>Найди свой спорт</h2>
          <p>30 направлений — от спокойной практики до командной игры.</p>
        </div>
        <Dumbbell size={48} strokeWidth={1.2} aria-hidden="true" />
      </div>
      <label className="sports-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Найти вид спорта" placeholder="Найти свой вид спорта"
          value={query} onChange={event => setQuery(event.target.value)} />
        {query && (
          <button type="button" aria-label="Очистить поиск спорта" onClick={() => setQuery("")}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>
      <div className="sports-categories" role="group" aria-label="Категории спорта">
        {categories.map(name => (
          <button type="button" key={name} aria-pressed={name === category} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="sports-catalogue-grid">
        {items.map(sport => (
          <button type="button" className="sport-card" key={sport.id} aria-label={sport.name} onClick={event => {
            activeCard.current = event.currentTarget;
            setSelected(sport);
          }}>
            <span className="sport-card-top">
              <span className="sport-card-icon"><SportSymbol sport={sport} size={26} strokeWidth={1.6} /></span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </span>
            <small>{sport.category}</small>
            <h3>{sport.name}</h3>
            <p>{sport.description}</p>
            <span className="sport-card-meta">
              <span><Clock3 size={13} aria-hidden="true" />{sport.duration} мин · {sport.weekdays.map(day => weekdays[day]).join(", ")}</span>
              <span><MapPin size={13} aria-hidden="true" />{sport.venue}</span>
            </span>
          </button>
        ))}
      </div>
      {!items.length && (
        <div className="sports-catalogue-empty" role="status">
          <Search size={26} aria-hidden="true" />
          <h3>Ничего не нашлось</h3>
          <p>Попробуй другое название или выбери все направления.</p>
          <button type="button" onClick={() => {
            setQuery("");
            setCategory(allCategories);
          }}>Сбросить поиск</button>
        </div>
      )}
      <Dialog open={Boolean(selected)} onClose={close} label={selected?.name || "Спортивное направление"}
        className="sports-dialog" maxWidth={1000} focusSelf>
        {selected && (
          <div className="sports-dialog-content">
            <button className="sports-dialog-close" type="button" aria-label="Закрыть вид спорта" onClick={close}>
              <X size={20} aria-hidden="true" />
            </button>
            <SportsBooking key={selected.id} {...bookingProps} activity={selected} onSend={sendRequest} showImage={false} />
          </div>
        )}
      </Dialog>
    </section>
  );
}
