import { PortalSection } from "../../shared/ui/PortalLoading.jsx";
import { lazy } from "react";
import { useSignals } from "@preact/signals-react/runtime";
const ServiceForm = lazy(() => import("./ServiceForm.jsx"));
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelRequest() {
  useSignals();
  const {
    busy,
    submitRequest,
    records,
    openRecord,
    housing,
    account,
    docName
  } = useCabinet();
  return <PortalSection layout="form">
                    <ServiceForm key={docName.value} housing={housing.value} records={records.value} onRecord={openRecord} name={docName.value} person={account.value} busy={busy.value} onSubmit={submitRequest} />
                  </PortalSection>;
}
