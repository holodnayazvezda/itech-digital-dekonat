import { Component, createElement, Suspense } from "react";
import { loadingNames, renderSkeleton } from "./portal-skeleton.js";
function placeholder(tag, className, children, key) {
  return createElement(tag, {
    className,
    key
  }, children);
}
export default function PortalLoading({
  layout = "requests",
  title,
  wide = false,
  onExit,
  onRetry
}) {
  return <div className={wide ? "portal-loading portal-loading-wide" : "portal-loading"}>
      <div role="status" aria-label={title || loadingNames[layout]} data-loading-layout={layout} data-route-loading={!(onRetry || onExit) || undefined}>
        <div aria-hidden="true">{renderSkeleton(placeholder, layout, wide)}</div>
      </div>
      {(onRetry || onExit) && <div className="portal-reconnect">
          <p role="alert">Не удалось подключиться к кабинету.</p>
          {onRetry && <button type="button" onClick={onRetry}>Повторить</button>}
          {onExit && <button type="button" onClick={onExit}>Вернуться ко входу</button>}
        </div>}
    </div>;
}
export class PortalSection extends Component {
  state = {
    failed: false
  };
  static getDerivedStateFromError() {
    return {
      failed: true
    };
  }
  render() {
    const {
      layout,
      children
    } = this.props;
    if (this.state.failed) {
      return <div className="portal-reconnect" role="alert">
        <p>Не удалось загрузить раздел.</p>
        <button type="button" onClick={() => location.reload()}>Обновить страницу</button>
      </div>;
    }
    return <Suspense fallback={<PortalLoading layout={layout} />}>{children}</Suspense>;
  }
}
