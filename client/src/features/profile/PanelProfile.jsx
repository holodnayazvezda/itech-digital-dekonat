import demoAccess from "../../shared/domain/demo-access.json";
import ProfilePanel from "../profile/ProfilePanel.jsx";
import { people } from "../../shared/domain/campus-data.js";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelProfile() {
  useSignals();
  const {
    signing,
    loginCategory,
    logout,
    loginRole,
    password,
    enter,
    owner,
    busy,
    account,
    avatar,
    demoIdentities,
    changeAvatar
  } = useCabinet();
  return <ProfilePanel account={account.value} avatar={avatar.value} owner={owner.value} identities={demoIdentities} people={people} allowSwitch={import.meta.env.VITE_CAMPUS_AUTH !== "password"} busy={busy.value || signing.value} onAvatar={changeAvatar} onLogout={logout} onSwitch={id => {
    password.value = demoAccess.accounts.find(account => account.id === id)?.password ?? "";
    loginRole.value = id;
    loginCategory.value = Object.keys(demoIdentities).find(key => demoIdentities[key].includes(id)) || "student";
    return enter();
  }} />;
}
