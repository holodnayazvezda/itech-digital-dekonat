import { mdiEyeOutline, mdiContentCopy, mdiEyeOffOutline } from "@mdi/js";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Icon } from "../../shared/ui/ui.jsx";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelWifi() {
  useSignals();
  const {
    owner,
    busy,
    wifiPassword,
    wifiReadyAt,
    wifiReadyTime,
    resetWifi,
    reveal,
    copy
  } = useCabinet();
  return <Fragment>
                    <p>
                      {"Сеть "}
                      <b>{"Campus Study"}</b>
                    </p>
                    <p>
                      {" Логин "}
                      <b>
                        {owner.value}
                        {".demo"}
                      </b>
                    </p>
                    <div className={"wifi-controls"}>
                      <div className={"wifi-field"}>
                        <label htmlFor="wifi-secret">
                          {"Пароль учебной сети"}
                        </label>
                        <div>
                          <input id="wifi-secret" autoComplete="off" readOnly spellCheck="false" type={reveal.value ? "text" : "password"} value={wifiPassword.value} />
                          <button type="button" aria-label={reveal.value ? "Скрыть пароль" : "Показать пароль"} aria-pressed={reveal.value} onClick={event => {
            reveal.value = !reveal.value;
          }}>
                            <Icon icon={reveal.value ? mdiEyeOffOutline : mdiEyeOutline} />
                          </button>
                        </div>
                      </div>
                      <button type="button" aria-label="Скопировать пароль" title="Скопировать пароль" onClick={copy} className={"wifi-copy"}>
                        <Icon icon={mdiContentCopy} />
                      </button>
                    </div>
                    <button className="wifi-reset" onClick={resetWifi} disabled={busy.value}>
                      {"Получить новый пароль"}
                    </button>
                    {wifiReadyAt.value > Date.now() ? <p role="status" className={"wifi-activation"}>
                        {" Новый пароль готов. Ориентировочное время активации — "}
                        {wifiReadyTime.value}
                        {" МСК, через 5 минут после смены. "}
                      </p> : null}
                  </Fragment>;
}
