# Веб-клиент цифрового деканата iTech

Клиент состоит из оболочки Vue 3, адресной навигации Vue Router и экранов React. Vite собирает приложение в статический каталог `dist/`. Preact Signals хранит состояние кабинета. Общие справочники и функции находятся в `shared/`.

## Запуск

Команды выполняются из `client/`. `npm ci` устанавливает зависимости по lock-файлу. `npm run dev` запускает Vite и Python API, `npm run dev:client` — Vite отдельно. В разработке запросы `/api/` проксируются на порт 8000.

Вход принимает логин и пароль. В демосборке выбор пользователя под формой заполняет опубликованные данные жюри. Для персональных доступов используйте сборку `VITE_CAMPUS_AUTH=password npm run build` и серверный файл аккаунтов. Переключатель демо-пользователей в этой сборке скрыт.

## Навигация и состояние

`src/main.jsx` запускает `src/CampusShell.js`. Оболочка показывает скелетон, получает время сервера и загружает `react-cabinet.jsx`, который монтирует `src/App.jsx`. `campus-routes.js` преобразует адреса страниц и историю браузера в состояние экрана и обратно.

`campus-client.js` передаёт Bearer JWT, загружает `state` и расписание, применяет согласованные ответы и очищает данные при выходе. JWT хранится в `sessionStorage` текущей вкладки. Решение о доступе к данным принимает Python API. Неуспешный вход, истёкшая сессия, конфликт и временная потеря связи обрабатываются отдельно.

Время берётся через `shared/server-clock.js` из `/api/campus/clock`, затем синхронизируется со `state`. `today()` возвращает реактивную серверную дату по Москве. Календарная дата устройства используется только для пользовательских временных меток, где это явно предусмотрено.

## Карта модулей

| Область | Основные файлы |
| --- | --- |
| Вход, профиль и настройки | `LoginForm.jsx`, `LoginFrame.jsx`, `AccountSelect.jsx`, `ProfilePanel.jsx`, `SettingsMenu.jsx` |
| Расписание и занятия | `CalendarView.jsx`, `TimetableWeek.jsx`, `LessonDetails.jsx`, `LessonActions.jsx`, `OfficeSchedule.jsx` |
| Выгрузка | `CalendarExport.jsx`, `calendar-export.js` — ICS и CSV для выбранного периода |
| Зачётка, план и элективы | `StudyGrades.jsx`, `UniversityHub.jsx`, `Electives.jsx` |
| Документы и заявления | `ServiceCatalog.jsx`, `ServiceForm.jsx`, `RequestList.jsx`, `RequestSummary.jsx`, `RequestCorrection.jsx` |
| Бронирование и спорт | `RoomFinder.jsx`, `SpaceBooking.jsx`, `SportsCatalogue.jsx`, `SportsBooking.jsx` |
| Финансы, общежития и Wi-Fi | `FinanceView.jsx`, `HousingView.jsx`, `WifiView.jsx` |
| Люди и структура | `UniversityDirectory.jsx`, `UniversityHub.jsx`, `GlobalSearch.jsx` |
| Чаты и деканат | `ChatInbox.jsx`, `LetterRecipient.jsx`, `OfficeTodo.jsx` |
| Навигатор | `CampusNavigator.jsx`, `CampusFloor.jsx`, `campus-map.js`, `campus-directions.js`, `map-projection.js` |
| Тинки | `Irishka.jsx`, `IrishkaReply.jsx`, `IrishkaActions.jsx`, `IrishkaMarkdown.jsx` |
| Уведомления | `notice-delivery.js`, `public/campus-worker.js` |
| Загрузка и общие элементы | `portal-skeleton.js`, `PortalLoading.jsx`, `image-ready.js`, `ui.jsx`, `PhoneNavigation.jsx` |
| Поиск по смыслу | `search.worker.js` — локальная модель из `public/models/` и `public/onnx/` |

## Данные и оформление

`npm run dev` и `npm run build` сначала синхронизируют справочники. При изменении помещений или структуры университета обновляется `../server/assets/campus.json`. Изменяемые личные сведения приходят из API. Источники и преобразования описаны в [общем руководстве](../README.md).

Токены светлой и тёмной тем заданы в `palette.json`. Стили разделены по областям — `timetable.css`, `lesson-details.css`, `people.css`, `services.css`, `navigator-design.css`, `irishka.css`. Общая оболочка использует `base.css`, `minimal.css`, `header.css` и `phone-navigation.css`.

На ширине до 640 px поиск и настройки находятся сверху, основные переходы — в нижней панели. Настройки и Тинки открываются на весь экран. Внешний вид поддерживает `prefers-reduced-motion`. Диалоги управляют фокусом и возвратом к элементу, который их открыл.

## Проверки

`npm test` проверяет общие алгоритмы. `npm run test:e2e` запускает браузерные сценарии на отдельном клиенте и временной БД. Команды выбора движка и проверки iPhone приведены в [README приложения](../README.md). При изменениях проверяйте прямой адрес страницы, возврат браузером, потерю связи, длинные ФИО, экранную клавиатуру и мобильную ширину от 320 px.

[API и хранение](../server/README.md) · [Формат карты](../docs/campus-map.md) · [Figma](../design/README.md)
