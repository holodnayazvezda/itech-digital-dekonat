import { createRoot } from "react-dom/client";
import App from "./App.jsx";

export function mountCabinet(host, navigation, onError) {
  const root = createRoot(host, { onUncaughtError: onError });
  root.render(<App navigation={navigation} />);
  return () => root.unmount();
}
