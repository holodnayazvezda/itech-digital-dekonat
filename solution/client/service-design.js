import { Wifi, Map, DoorOpen, Dumbbell, Files, ClipboardList, Wallet, Users, BookOpen, Building2, GraduationCap, MessageCircle } from "lucide-react";

export const serviceDesign = {
  study: { icon:GraduationCap, color:"#626f92", description:"Оценки, успеваемость и учебный план." },
  wifi: { icon:Wifi, color:"#465cce", description:"Подключение к сети кампуса и управление доступом." },
  navigator: { icon:Map, color:"#287a66", description:"Корпуса, этажи и маршруты до нужной аудитории." },
  spaces: { icon:DoorOpen, color:"#6759a0", image:"services/booking-room.png", description:"Найдите свободную аудиторию или место для совместной работы." },
  sports: { icon:Dumbbell, color:"#ad653b", image:"services/sports.png", description:"Выберите время тренировки и запишитесь в спортзал." },
  docs: { icon:Files, color:"#386e86", description:"Справки, заявления и обращения в студенческий офис." },
  booked: { icon:ClipboardList, color:"#99614d", description:"Ваши обращения, бронирования и решения деканата." },
  finance: { icon:Wallet, color:"#267e61", image:"services/scholarship-wallet.png", description:"Начисления, состав выплат и история по месяцам." },
  threads: { icon:MessageCircle, color:"#626f92" },
  directory: { icon:Users, color:"#626f92", description:"Найдите студента, преподавателя или сотрудника." },
  electives: { icon:BookOpen, color:"#837048", description:"Доступные курсы и ваш выбор на следующий семестр." },
  dorm: { icon:Building2, color:"#36785c", image:"services/student-residence.png", description:"Проживание, начисления и обращения по общежитию." },
};
