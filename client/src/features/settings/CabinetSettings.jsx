import SettingsMenu, { DemoTimeInput } from "./SettingsMenu.jsx";
import { ChevronRight } from "lucide-react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from '../../shared/state/CabinetContext.jsx';
export default function CabinetSettings() {
  useSignals();
  const {
    phone,
    themeName,
    setAppearance,
    themePreference,
    ThemeIcon,
    open,
    unreadCount,
    demoTime,
    setDemoTime,
    logout
  } = useCabinet();
  return <SettingsMenu phone={phone} themeButton={<button type="button" aria-label={"Тема: " + themeName} title="Сменить тему: светлая, тёмная, автоматическая" onClick={() => setAppearance({
    Light: "Dark",
    Dark: "System",
    System: "Light"
  }[themePreference.value] || "Light")}>
        <ThemeIcon size={20} strokeWidth={1.6} aria-hidden="true" />
        {phone && <span>Тема · {themeName}</span>}
      </button>}>{dismiss => <div className="settings-list">
        <button className="record" onClick={() => {
        dismiss();
        open("notices");
      }}>
          <span><b>Уведомления</b><small>Непрочитанных: {unreadCount.value}</small></span>
          <ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <button className="record" onClick={() => {
        dismiss();
        open("profile");
      }}>
          <span><b>Профиль</b><small>Фото и данные аккаунта</small></span>
          <ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <details className="demo-disclosure">
          <summary><span>Демонстрационные данные</span><ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" /></summary>
          <div className="demo-settings">
            {!phone && <div className="demo-time-field">
              <span>Время для демонстрации</span>
              <DemoTimeInput value={demoTime.value} onChange={setDemoTime} />
            </div>}
            <button onClick={logout} className="demo-switch">Сменить кабинет<ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" /></button>
          </div>
        </details>
        <small className="settings-prototype-label">Конкурсный прототип</small>
      </div>}</SettingsMenu>;
}
