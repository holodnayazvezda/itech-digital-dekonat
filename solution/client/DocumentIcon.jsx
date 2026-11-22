import { FileCheck2, FileText, ArrowLeftRight, ListChecks, MessagesSquare, CalendarClock, BriefcaseBusiness, BookCopy, Files, Wallet, GraduationCap, Building2, Archive, BookOpen, CalendarDays, HeartHandshake, ContactRound, IdCard, KeyRound, House, Headphones, Wrench, ClockArrowUp, Play, ClipboardList } from "lucide-react";

const icons = {
  "Справка об обучении":FileCheck2,
  "Выписка из зачётной книжки":BookOpen,
  "Перевод на другую программу":ArrowLeftRight,
  "Индивидуальный учебный план":ListChecks,
  "Запись на консультацию":MessagesSquare,
  "Продление срока аттестации":CalendarClock,
  "Заявка на стажировку":BriefcaseBusiness,
  "Перезачёт дисциплины":BookCopy,
  "Справка о периоде обучения":CalendarDays,
  "Справка о размере стипендии":Wallet,
  "Справка об отсутствии стипендии":Wallet,
  "Справка для общежития":Building2,
  "Выписка из приказа":ClipboardList,
  "Копия аттестата или диплома":Files,
  "Временная выдача оригинала документа":BookCopy,
  "Справка-вызов":CalendarClock,
  "Архивная справка":Archive,
  "Характеристика с места учёбы":GraduationCap,
  "Академический отпуск":CalendarDays,
  "Продление академического отпуска":ClockArrowUp,
  "Выход из академического отпуска":Play,
  "Материальная помощь":HeartHandshake,
  "Назначение социальной стипендии":Wallet,
  "Повышенная академическая стипендия":GraduationCap,
  "Восстановление студенческого билета":IdCard,
  "Изменение персональных данных":ContactRound,
  "Замена пропуска":KeyRound,
  "Заселение в общежитие":House,
  "Обращение в поддержку общежития":Headphones,
  "Заявка на ремонт в общежитии":Wrench,
};
const hints = {
  "Справка об обучении":"Подтверждение статуса студента",
  "Выписка из зачётной книжки":"Оценки за выбранный период",
  "Перевод на другую программу":"Смена образовательной программы",
  "Индивидуальный учебный план":"Обучение по индивидуальному плану",
  "Запись на консультацию":"Вопросы по дисциплине",
  "Продление срока аттестации":"Изменение срока сдачи",
  "Заявка на стажировку":"Организация и даты стажировки",
  "Перезачёт дисциплины":"Ранее изученные дисциплины",
  "Заселение в общежитие":"Выбор общежития и даты заселения",
  "Заявка на ремонт в общежитии":"Неполадки в комнате",
};
export function documentHint(service) { return hints[service.name] || (service.certificate ? "Заказать справку или выписку" : "Подать заявление онлайн"); }
export default function DocumentIcon({name}) {
  const Icon=icons[name] || FileText;
  return <Icon size={25} strokeWidth={1.9} aria-hidden="true"/>;
}
