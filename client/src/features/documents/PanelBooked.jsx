import RequestList from "./RequestList.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelBooked() {
  useSignals();
  const {
    records,
    openRecord
  } = useCabinet();
  return <Fragment>
                    <RequestList records={records.value} onSelect={openRecord} />
                  </Fragment>;
}
