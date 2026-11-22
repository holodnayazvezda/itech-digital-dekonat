import Irishka from "./Irishka.jsx";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from '../../shared/state/CabinetContext.jsx';
export default function CabinetAssistant() {
  useSignals();
  const {
    phone,
    owner,
    assistantApi,
    assistantSendStream,
    bookAssistantSport,
    records,
    account,
    role,
    openAssistantAction,
    assistantHref
  } = useCabinet();
  return <Irishka phone={phone} key={owner.value} ownerId={owner.value} request={assistantApi} sendStream={assistantSendStream} onBookSport={bookAssistantSport} sportsBookings={records.value.filter(record => record.sport)} name={account.value.name} role={role.value} onAction={openAssistantAction} actionHref={assistantHref} />;
}
