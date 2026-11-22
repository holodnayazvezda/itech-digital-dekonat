import { synchronizeClock } from "../shared/server-clock.js";
import { h, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { layoutForRoute, renderSkeleton } from "./portal-skeleton.js";

const placeholder = (tag, className, children, key) => h(tag, { class: className, key }, children);

export default {
  name: "CampusShell",
  props: { navigation: { type: Object, required: true } },
  setup(props) {
    const viewport = ref(null);
    const status = ref("loading");
    const appearance = localStorage.getItem("campus-theme") || "System";
    const restoring = Boolean(sessionStorage.getItem("atlas-session"));
    const layout = restoring
      ? layoutForRoute(props.navigation.read(), sessionStorage.getItem("atlas-layout-role"))
      : "login";
    let unmountCabinet;
    let mounted = true;
    let observation;
    let frame;
    function stopObservation() {
      observation?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    }
    function checkReady() {
      if (frame !== undefined || !mounted || status.value !== "loading") return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const host = viewport.value;
        if (!host?.firstElementChild || host.querySelector("[data-route-loading]")) return;
        stopObservation();
        status.value = "ready";
      });
    }
    onMounted(async () => {
      try {
        const [{ mountCabinet }] = await Promise.all([
          import("./react-cabinet.jsx"),
          props.navigation.router.isReady(),
          synchronizeClock(),
        ]);
        if (!mounted) return;
        observation = new MutationObserver(checkReady);
        observation.observe(viewport.value, {
          childList: true, subtree: true, attributes: true, attributeFilter: ["data-route-loading"],
        });
        unmountCabinet = mountCabinet(viewport.value, props.navigation, () => {
          stopObservation();
          status.value = "error";
        });
      } catch {
        stopObservation();
        status.value = "error";
      }
    });
    onBeforeUnmount(() => {
      mounted = false;
      stopObservation();
      if (unmountCabinet) void nextTick(unmountCabinet);
    });
    return () => {
      return [
        status.value === "loading" && h("main", {
          class: "campus-bootstrap", role: "status",
          "aria-label": restoring ? "Восстанавливаем кабинет" : "Загружаем вход",
          "data-appearance": appearance, "data-loading-layout": layout,
        }, [
          h("div", { "aria-hidden": "true" }, [renderSkeleton(placeholder, layout, true)]),
        ]),
        status.value === "error" && h("main", { class: "campus-bootstrap portal-bootstrap-error", "data-appearance": appearance }, [
          h("h1", "Кабинет не загрузился"),
          h("p", "Обновите страницу, чтобы подключиться снова."),
          h("button", { onClick: () => location.reload() }, "Обновить"),
        ]),
        h("div", {
          ref: viewport,
          class: status.value === "loading" ? "campus-startup-stage" : undefined,
          inert: status.value !== "ready" || undefined,
          "aria-hidden": status.value !== "ready" ? "true" : undefined,
          hidden: status.value === "error",
        }),
      ];
    };
  },
};
