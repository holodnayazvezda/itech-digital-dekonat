import { useSyncExternalStore } from "react";
import { useImageReady } from "../../shared/ui/image-ready.js";
const panorama = import.meta.env.BASE_URL + "university-campus.png";
const panoramaQuery = "(width > 680px)";
function subscribe(onChange) {
  const media = window.matchMedia(panoramaQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const matchesPanorama = () => window.matchMedia(panoramaQuery).matches;
export default function LoginFrame({
  children,
  style
}) {
  const showPanorama = useSyncExternalStore(subscribe, matchesPanorama);
  const {
    pending,
    imageProps
  } = useImageReady(panorama, showPanorama);
  return <main className="login-page" style={style} data-image-pending={pending || undefined} data-route-loading={pending || undefined}>
      {pending && <span className="media-loading-status" role="status" aria-label="Загружаем вход" />}
      <div className="login-copy" inert={pending || undefined}>
        <p className="login-prototype-label"><span className="image-skeleton-text">Конкурсный прототип</span></p>
        <h1><span className="image-skeleton-text">Вход</span></h1>
        {children}
      </div>
      {showPanorama && <div className="login-panorama image-skeleton-block">
          <img {...imageProps} alt="Кампус вымышленного университета" fetchPriority="high" width="1122" height="1402" />
        </div>}
    </main>;
}
