"""Public wire types. Timestamps are Unix milliseconds unless explicitly named otherwise."""

from datetime import date as CalendarDate
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Clock = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):(00|30)$", examples=["14:30"])]
Status = Literal["pending", "clarification", "approved", "rejected", "cancelled"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(Input):
    role: str = Field(
        description="Идентификатор кабинета. Роль определяется сервером.",
        examples=["student", "friend", "teacher", "office"],
    )
    password: str | None = Field(
        None, max_length=1024,
        description="Пароль учётной записи. В деморежиме используются опубликованные тестовые доступы.",
        json_schema_extra={"writeOnly": True},
    )


class Token(BaseModel):
    token: str = Field(description="Access JWT. Скопируйте значение в Authorize.")
    token_type: Literal["bearer"] = Field(
        "bearer", description="Схема заголовка Authorization"
    )
    expires_in: int = Field(description="Срок действия в секундах")


class Error(BaseModel):
    error: str = Field(description="Сообщение для пользователя")


class Ok(BaseModel):
    ok: bool = Field(True, description="Операция выполнена")


class ClearNotes(Input):
    through_id: int = Field(gt=0, le=2**63 - 1, description="ID самого нового уведомления в очищаемом списке")


class RecordId(Input):
    id: Text = Field(description="Идентификатор обращения")


class Discussion(RecordId):
    body: Text = Field(
        max_length=2500, description="Вопрос деканата или ответ заявителя"
    )


class Decision(RecordId):
    status: Literal["approved", "rejected"] = Field(
        description="Решение сотрудника деканата"
    )
    reason: str = Field("", max_length=1200, description="Комментарий к решению")


class MessageIn(Input):
    to: Text = Field(description="Идентификатор получателя", examples=["friend"])
    body: Text = Field(
        max_length=4000,
        examples=["Когда начинается консультация?"],
        description="Текст сообщения",
    )


class TeachingGroup(BaseModel):
    group: str = Field(description="Код учебной группы преподавателя", examples=["АД-21"])
    recipients: int = Field(ge=0, description="Число студентов этой группы")


class GroupMessage(Input):
    group: Text = Field(max_length=80, description="Код группы из state.teachingGroups", examples=["АД-21"])
    body: Text = Field(max_length=4000, description="Текст для личного диалога с каждым студентом")
    requestId: UUID = Field(description="Идентификатор отправки. При повторе того же запроса передайте прежний UUID")


class GroupDelivery(TeachingGroup):
    requestId: UUID = Field(description="Идентификатор подтверждённой отправки")


class Letter(Input):
    to: Text = Field(examples=["student"], description="Идентификатор получателя")
    subject: Text = Field(max_length=140, examples=["Ваша справка"], description="Тема")
    body: Text = Field(max_length=12000, description="Полный текст письма")


class ElectiveChoice(Input):
    juryPreview: bool = Field(
        False, description="Запись вне периода в разрешённом режиме жюри"
    )
    course: Text = Field(examples=["viz"], description="Код выбранного электива")
    previous: str = Field(
        description="Предыдущий выбор из state, пустая строка при первом выборе",
        examples=[""],
    )


class Avatar(Input):
    image: str = Field(description="PNG data URL до 2 МиБ", max_length=2796230)


class Upload(Input):
    name: Text = Field(
        max_length=255,
        examples=["подтверждение.pdf"],
        description="Имя файла с расширением",
    )
    mime: Literal["application/pdf", "image/png", "image/jpeg"] = Field(
        description="Тип содержимого файла"
    )
    base64: str = Field(
        max_length=2796204,
        description="Содержимое файла Base64, до 2 МиБ после декодирования",
    )


class Supplement(Discussion):
    attachment: Upload | None = None


class RequestCreation(Input):
    requestId: UUID | None = Field(
        None, description="Ключ повторной отправки. При повторе возвращается та же заявка."
    )


class Booking(RequestCreation):
    sport: str | None = Field(None, max_length=40, description="Идентификатор спортивного направления")
    kind: Literal["booking"] = Field(description="Вид обращения")
    short: str = Field(examples=["Б-108"], description="Код помещения")
    date: CalendarDate = Field(
        examples=["2026-11-20"],
        description="Дата брони, с 20.11 по 28.12.2026 включительно",
    )
    time: Clock = Field(description="Начало по Москве, шаг 30 минут")
    end: Clock = Field(description="Окончание по Москве, шаг 30 минут")


class Document(RequestCreation):
    kind: Literal["document"] = Field(description="Вид обращения")
    name: Text = Field(examples=["Справка об обучении"], description="Название")
    format: str = Field("", description="Для справки — Электронная или Бумажная")
    values: dict[str, Annotated[str, StringConstraints(strip_whitespace=True)]] = Field(
        description="Поля по схеме услуги из GET /catalog",
        examples=[{"destination": "По месту требования"}],
    )
    comment: str = Field("", max_length=2500, description="Комментарий заявителя")
    attachment: Upload | None = Field(
        None, description="Приложенный подтверждающий документ"
    )


class PushKeys(Input):
    auth: str = Field(
        pattern=r"^[A-Za-z0-9_-]{22}={0,2}$",
        description="Секрет шифрования подписки Base64URL",
    )
    p256dh: str = Field(
        pattern=r"^[A-Za-z0-9_-]{87}=?$",
        description="Открытый ключ браузера P-256, Base64URL",
    )


class Subscription(Input):
    endpoint: str = Field(description="HTTPS endpoint службы Web Push")
    keys: PushKeys = Field(description="Публичные параметры шифрования подписки")
    expirationTime: int | None = Field(
        None, description="Время окончания подписки в Unix-миллисекундах или null"
    )


class Subscribe(Input):
    subscription: Subscription = Field(
        description="Результат PushSubscription.toJSON()"
    )


class Unsubscribe(Input):
    endpoint: str = Field(description="Адрес подписки, полученный от браузера")


class PublicKey(BaseModel):
    key: str = Field(description="Открытый ключ VAPID, Base64URL")


class Building(BaseModel):
    name: str = Field(description="Название")
    short: str = Field(description="Сокращённое обозначение корпуса")
    image: str = Field(description="Имя файла архитектурной иллюстрации")
    alt: str = Field(description="Текстовое описание корпуса")


class Requirement(BaseModel):
    subject: str = Field(description="Предмет вступительного минимума")
    met: bool = Field(description="Условие выполнено")


class Entry(BaseModel):
    sender: str = Field(description="Идентификатор отправителя")
    body: str = Field(description="Текст сообщения")
    created: int = Field(description="Время создания в Unix-миллисекундах")


class Record(BaseModel):
    sport: str | None = Field(None, description="Спортивное направление")
    id: str = Field(description="Идентификатор записи")
    owner: str = Field(description="Идентификатор владельца")
    kind: Literal["booking", "document"] = Field(description="Вид обращения")
    status: Status = Field(description="Текущее состояние обращения")
    name: str = Field(description="Название")
    created: int = Field(description="Время создания в Unix-миллисекундах")
    short: str | None = Field(None, description="Код помещения")
    building: Building | None = Field(None, description="Корпус кампуса")
    date: CalendarDate | None = Field(None, description="Календарная дата по Москве")
    time: Clock | None = Field(None, description="Начало по Москве, шаг 30 минут")
    end: Clock | None = Field(None, description="Окончание по Москве, шаг 30 минут")
    format: str | None = Field(None, description="Форма выдачи документа")
    comment: str | None = Field(None, description="Комментарий заявителя")
    details: dict[str, str] | None = Field(
        None, description="Заполненные поля с подписями для заявителя"
    )
    requirements: list[Requirement] | None = Field(
        None, description="Условия перевода и результат их проверки"
    )
    attachment: str | None = Field(
        None,
        description="Отображаемое имя файла, содержимое доступно отдельным запросом",
    )
    expires: int | None = Field(
        None, description="Окончание доступа к электронному PDF, Unix мс"
    )
    discussion: list[Entry] | None = Field(
        None, description="Вопросы деканата и ответы владельца"
    )
    reason: str | None = Field(None, description="Пояснение к решению")


class CreatedRecord(RecordId):
    record: Record = Field(description="Сохранённая карточка обращения для показа сразу после подачи")


class Message(Entry):
    id: int = Field(description="Идентификатор записи")
    recipient: str = Field(description="Идентификатор адресата")


class Note(BaseModel):
    read: bool = Field(description="Адресат открыл уведомление")
    id: int = Field(description="Идентификатор записи")
    owner: str = Field(description="Идентификатор владельца")
    title: str = Field(description="Заголовок уведомления")
    body: str = Field(description="Текст сообщения")
    priority: int = Field(description="Приоритет от 1 до 4, выше означает важнее")
    ref: str = Field(
        description="Идентификатор обращения, chat:<id>, electives или пустая строка"
    )
    created: int = Field(description="Время создания в Unix-миллисекундах")


class Reservation(BaseModel):
    sport: str | None = Field(None, description="Спортивное направление")
    short: str = Field(description="Код помещения")
    date: CalendarDate = Field(description="Календарная дата по Москве")
    time: Clock = Field(description="Начало по Москве, шаг 30 минут")
    end: Clock = Field(description="Окончание по Москве, шаг 30 минут")
    by: str = Field(description="Подпись занятости для общего расписания")


class Wifi(BaseModel):
    password: str = Field(description="Демонстрационный сетевой пароль")
    ready: int = Field(
        description="Момент активации в Unix-миллисекундах, 0 для первоначального пароля"
    )


class Payments(BaseModel):
    lines: list[tuple[str, int, str]] = Field(
        description="Строки начислений [название, рубли, основание]"
    )
    total: int = Field(description="Общая начисленная сумма в рублях")
    transfers: list[tuple[CalendarDate, str, int]] = Field(
        description="Платежи [дата, назначение, сумма в рублях]"
    )


class Electives(BaseModel):
    opens: CalendarDate = Field(description="Первый день записи по Москве")
    closes: CalendarDate = Field(description="Последний день записи включительно")
    phase: Literal["upcoming", "open", "closed"] = Field(
        description="Статус окна выбора"
    )
    juryAvailable: bool = Field(
        description="Разрешён ли демонстрационный выбор вне периода"
    )
    selected: str = Field(description="Код выбранного курса или пустая строка")
    remaining: dict[str, int] = Field(
        description="Количество доступных мест по кодам курсов"
    )


class Grade(BaseModel):
    grade: str = Field(description="Итог дисциплины или состояние аттестации")
    name: str = Field(description="Название")
    summary: str = Field(description="Вид контроля и результат")
    points: list[tuple[str, int, int]] = Field(
        description="Контрольная точка, полученные баллы и максимум"
    )


class HousingCharge(BaseModel):
    due: CalendarDate = Field(description="Срок оплаты за месяц проживания")
    amount: int = Field(ge=0, description="Начислено за месяц, руб.")
    paid: int = Field(ge=0, description="Зачтено за месяц, руб.")
    posted: CalendarDate | None = Field(description="Дата последнего зачисления")


class HousingAccount(BaseModel):
    building: str = Field(description="Название выделенного общежития")
    room: str | None = Field(description="Комната после распределения")
    start: CalendarDate = Field(description="Дата начала проживания")
    charges: list[HousingCharge] = Field(description="Начисления и поступления по месяцам")


class ServerClock(BaseModel):
    now: str = Field(description="Серверное время в ISO 8601 с часовым смещением.")
    date: str = Field(description="Сегодняшняя дата YYYY-MM-DD по Москве.")
    timezone: str = Field(description="Часовой пояс университета.", examples=["Europe/Moscow"])


class State(BaseModel):
    clock: ServerClock = Field(description="Текущая дата и время сервера по Москве.")
    scheduleRevision: int = Field(0, description="Версия опубликованного расписания")
    lessonChanges: list["LessonChange"] = Field(default_factory=list, description="Изменения занятости аудиторий")
    housing: HousingAccount | None = Field(description="Проживание текущего пользователя, если место предоставлено")
    grades: list[Grade] = Field(description="Личная зачётка текущего студента")
    owner: str = Field(description="Идентификатор владельца")
    role: str = Field(description="Роль текущего пользователя")
    records: list[Record] = Field(description="Обращения, доступные этому кабинету")
    notes: list[Note] = Field(description="Входящие уведомления от новых к старым")
    teachingGroups: list[TeachingGroup] = Field(description="Группы для рассылок текущего преподавателя")
    messages: list[Message] = Field(description="Личные сообщения в порядке отправки")
    reservations: list[Reservation] = Field(
        description="Одобренные брони без закрытых полей заявок"
    )
    electives: Electives | None = Field(
        description="Выбор дисциплины и доступные места у студентов"
    )
    wifi: Wifi | None = Field(
        description="Сетевые реквизиты доступных категорий участников"
    )
    payments: dict[str, Payments] = Field(
        description="Персональные начисления по месяцам YYYY-MM"
    )
    avatars: dict[str, str] = Field(
        description="Доступные в справочнике аватары в формате data URL"
    )


class ServiceField(BaseModel):
    id: str = Field(description="Идентификатор записи")
    label: str = Field(description="Подпись поля формы")
    type: str = Field(
        description="Контрол формы: text, textarea, select, program, date, email или tel"
    )
    options: list[str] | None = Field(
        None, description="Допустимые значения для выбора"
    )


class Service(BaseModel):
    name: str = Field(description="Название")
    group: str = Field(description="Тематический раздел каталога")
    fields: list[ServiceField] = Field(description="Схема обязательных полей заявления")
    certificate: bool = Field(
        description="Доступен выбор электронной или бумажной справки"
    )


class Lesson(BaseModel):
    id: str = Field(description="Стабильный идентификатор занятия")
    date: CalendarDate = Field(description="Календарная дата по Москве")
    time: str = Field(description="Начало по Москве", examples=["11:40"])
    end: str = Field(description="Окончание по Москве", examples=["12:20"])
    name: str = Field(description="Название")
    type: str = Field(description="Вид занятия")
    teacher: str = Field(description="Фамилия, имя и отчество преподавателя")
    room: str = Field(description="Код аудитории")
    group: str = Field(description="Учебная группа")
    building: Building = Field(description="Корпус кампуса")
    floor: int | str = Field(description="Номер или обозначение этажа", examples=[3, "М"])
    revision: int = 0
    cancelled: bool = False
    changed: bool = False
    previous: "LessonSlot | None" = None
    changeReason: str | None = None
    canManage: bool = False


class LessonSlot(BaseModel):
    date: CalendarDate
    time: str
    end: str
    room: str


class LessonChange(BaseModel):
    original: LessonSlot
    lesson: Lesson


class LessonAction(Input):
    lessonId: Text = Field(max_length=160)
    requestId: UUID
    revision: int | None = Field(None, ge=0)
    body: Text = Field(max_length=2500)
    date: CalendarDate | None = None
    time: Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")] | None = None
    room: Text | None = Field(None, max_length=32)


class LessonActionResult(BaseModel):
    lesson: Lesson
    recipients: int
    revision: int
