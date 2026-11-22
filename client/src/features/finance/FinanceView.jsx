import { printDate, today } from "../../shared/domain/timetable.js";
import { computed, useSignal } from "@preact/signals-react";
import { useRef, useLayoutEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useWatch, useMount, afterPaint, Dialog } from "../../shared/ui/ui.jsx";
import AccountSelect from "../../shared/ui/AccountSelect.jsx";
import { WalletCards, GraduationCap, ArrowDownLeft, Clock3, ChevronLeft, ChevronRight, X } from "lucide-react";
import "./finance.css";
export default function FinanceView(props) {
  useSignals();
  const financePeriods = computed(() => Object.keys(props.payments).sort().reverse());
  const selectedMonth = useSignal(financePeriods.value[0]);
  const month = computed(() => props.payments[selectedMonth.value] ? selectedMonth.value : financePeriods.value[0]);
  const year = computed(() => (month.value || today()).slice(0, 4));
  const years = computed(() => [...new Set(financePeriods.value.map(p => p.slice(0, 4)))]);
  const months = computed(() => financePeriods.value.filter(p => p.startsWith(year.value)).reverse());
  const strip = useRef(null);
  const history = useRef(null),
    withdrawal = useSignal(false);
  function showHistory() {
    history.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center'
    });
  }
  function selectYear(value) {
    const same = value + month.value.slice(4);
    selectedMonth.value = props.payments[same] ? same : financePeriods.value.find(p => p.startsWith(value));
  }
  function revealMonth() {
    afterPaint(() => {
      const bar = strip.current,
        active = bar?.querySelector("[aria-pressed=true]");
      if (active) bar.scrollLeft += active.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - active.offsetWidth) / 2;
    });
  }
  useMount(revealMonth);
  useWatch(month, revealMonth);
  const bill = computed(() => props.payments[month.value]);
  const transferred = computed(() => bill.value?.transfers.filter(([d]) => d <= today()).reduce((sum, [,, amount]) => sum + amount, 0) || 0);
  const planned = computed(() => bill.value?.transfers.filter(([d]) => d > today()).reduce((sum, [,, amount]) => sum + amount, 0) || 0);
  const money = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  });
  const date = value => printDate(value, {
    day: "numeric",
    month: "long",
    ...(value.slice(0, 4) !== year.value ? {
      year: "numeric"
    } : {})
  });
  const period = value => printDate(value + "-01", {
    month: "long"
  });
  useLayoutEffect(() => {
    if (!strip.current) return;
    const observer = new ResizeObserver(revealMonth);
    observer.observe(strip.current);
    return () => observer.disconnect();
  }, [Boolean(bill.value)]);
  if (!bill.value) return <p>Начислений пока нет.</p>;
  return <>
      <section aria-label="Расчёт за месяц" className={"finance scholarship-view"}>
        <div aria-label="Расчётный месяц" className={"pay-periods"}>
          <AccountSelect label="Расчётный год" value={year.value} onChange={selectYear} options={years.value.map(value => ({
          value,
          label: value
        }))} />
          <button aria-label="Предыдущие месяцы" onClick={event => {
          strip.current.scrollBy({
            left: -220,
            behavior: "smooth"
          });
        }} className={"month-arrow"}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <div ref={strip} className={"month-strip"}>
            {months.value.map(p => <button key={p} aria-pressed={p === month.value} onClick={event => {
            selectedMonth.value = p;
          }}>
                {period(p)}
              </button>)}
          </div>
          <button aria-label="Следующие месяцы" onClick={event => {
          strip.current.scrollBy({
            left: 220,
            behavior: "smooth"
          });
        }} className={"month-arrow"}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
        <div className={"finance-total finance-balance-card"}>
          <div className="finance-card-top"><span><WalletCards size={15} strokeWidth={1.8} />Баланс</span><span className="finance-card-month">{period(month.value)} {year.value}</span></div>
          <div className="finance-card-amount" key={month.value}>
          <b>{money.format(bill.value.total)}</b>
          <small>{props.role === "student" ? "Стипендия за месяц" : "Начисления за месяц"}</small>
          </div>
          <div className="finance-card-actions"><button onClick={() => {
            withdrawal.value = true;
          }}>Вывести</button><button onClick={showHistory}>История</button></div>
        </div>
        {!bill.value.lines.length && props.role === "student" ? <p>{" За этот месяц стипендии не назначены. "}</p> : <div className={"pay-columns"}>
            <section>
              <h3>{"Состав начислений"}</h3>
              <dl className={"ledger finance-accruals"}>
                {bill.value.lines.map(([label, value, desc]) => <div key={label}>
                    <span className="finance-row-icon" aria-hidden="true"><GraduationCap size={18} strokeWidth={1.6} /></span>
                    <dt>
                      {label}
                      <small>{desc}</small>
                    </dt>
                    <dd>{money.format(value)}</dd>
                  </div>)}
              </dl>
            </section>
            <section ref={history}>
              <h3>{"График выплат"}</h3>
              <dl className={"ledger finance-transfers"}>
                {bill.value.transfers.map(([d, title, value]) => <div key={d}>
                    <span className="finance-row-icon" data-planned={d > today()} aria-hidden="true">{d <= today() ? <ArrowDownLeft size={18} /> : <Clock3 size={18} />}</span>
                    <dt>
                      {title}
                      <small>
                        {date(d)}
                        {" · "}
                        {d <= today() ? "Перечислено" : "Запланировано"}
                      </small>
                    </dt>
                    <dd>{money.format(value)}</dd>
                  </div>)}
              </dl>
            </section>
          </div>}
        <small className={"pay-note"}>
          {"Учебный расчёт. Суммы и даты демонстрационные."}
        </small>
      </section>
      <Dialog open={withdrawal.value} onClose={() => {
      withdrawal.value = false;
    }} label="Вывод стипендии" className="finance-withdraw-dialog" maxWidth={380}>
        <div className="finance-withdraw-content"><div className="finance-withdraw-heading"><h2>Выплата стипендии</h2><button aria-label="Закрыть" className="circle" onClick={() => {
            withdrawal.value = false;
          }}><X size={18} /></button></div>
          <strong>{money.format(bill.value.total)}</strong><p>Стипендия перечисляется автоматически по графику выплат.</p>
          <dl><div><dt>Перечислено</dt><dd>{money.format(transferred.value)}</dd></div><div><dt>Ожидается</dt><dd>{money.format(planned.value)}</dd></div></dl>
          <button className="finance-history-action" onClick={() => {
          withdrawal.value = false;
          requestAnimationFrame(showHistory);
        }}>Посмотреть график</button>
        </div>
      </Dialog>
    </>;
}
