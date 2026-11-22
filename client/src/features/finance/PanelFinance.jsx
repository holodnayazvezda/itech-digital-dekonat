import { PortalSection } from "../../shared/ui/PortalLoading.jsx";
import { lazy } from "react";
import { useSignals } from "@preact/signals-react/runtime";
const FinanceView = lazy(() => import("./FinanceView.jsx"));
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelFinance() {
  useSignals();
  const {
    role,
    payments
  } = useCabinet();
  return <PortalSection layout="payment">
                    <FinanceView role={role.value} payments={payments.value} />
                  </PortalSection>;
}
