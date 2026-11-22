import { useMemo, useState } from "react";
import { directoryPeople } from "../../shared/domain/university.js";
const people = Object.values(directoryPeople);
const normalize = text => text.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
export default function LetterRecipient({
  owner,
  value,
  onChange
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const search = normalize(query);
    const matches = [];
    for (const person of people) {
      if (person.id === owner) continue;
      if (search && !normalize([person.name, person.number, person.unit].join(" ")).includes(search)) continue;
      matches.push(person);
      if (matches.length >= 25) break;
    }
    return matches;
  }, [query, owner]);
  return <>
    <label className="field">
      Найти получателя
      <input type="search" placeholder="ФИО, группа или табельный номер" value={query} onChange={event => {
        setQuery(event.target.value);
        onChange("");
      }} />
    </label>
    <label className="field">
      Получатель
      <select required value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{results.length ? "Выберите получателя" : "Никого не найдено"}</option>
        {results.map(person => <option value={person.id} key={person.id}>{person.name} · {person.unit || person.title} · {person.number}</option>)}
      </select>
    </label>
  </>;
}
