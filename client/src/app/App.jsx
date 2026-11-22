import { CabinetContext } from '../shared/state/CabinetContext.jsx';
import useCabinetController from './useCabinetController.jsx';
import CabinetWorkspace from './CabinetWorkspace.jsx';
export default function App({
  navigation
}) {
  const controller = useCabinetController({
    navigation
  });
  return <CabinetContext.Provider value={controller}><CabinetWorkspace /></CabinetContext.Provider>;
}
