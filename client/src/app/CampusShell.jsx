import React, { Component, useEffect, useRef, useState } from 'react';
import { synchronizeClock } from '../shared/domain/server-clock.js';
import { layoutForRoute, renderSkeleton } from '../shared/ui/portal-skeleton.js';
const placeholder = (tag, className, children, key) => React.createElement(tag, {
  className,
  key
}, children);
function Loading({
  layout,
  restoring,
  appearance
}) {
  return <main className="campus-bootstrap" role="status" aria-label={restoring ? 'Восстанавливаем кабинет' : 'Загружаем вход'} data-appearance={appearance} data-loading-layout={layout}><div aria-hidden="true">{renderSkeleton(placeholder, layout, true)}</div></main>;
}
function Failure({
  appearance
}) {
  return <main className="campus-bootstrap portal-bootstrap-error" data-appearance={appearance}><h1>Кабинет не загрузился</h1><p>Обновите страницу, чтобы подключиться снова.</p><button onClick={() => location.reload()}>Обновить</button></main>;
}
class Boundary extends Component {
  state = {
    failed: false
  };
  static getDerivedStateFromError() {
    return {
      failed: true
    };
  }
  render() {
    return this.state.failed ? <Failure appearance={this.props.appearance} /> : this.props.children;
  }
}
export default function CampusShell({
  navigation
}) {
  const [View, setView] = useState(null);
  const [status, setStatus] = useState('loading');
  const viewport = useRef(null);
  const appearance = localStorage.getItem('campus-theme') || 'System';
  const restoring = Boolean(sessionStorage.getItem('atlas-session'));
  const layout = useRef(restoring ? layoutForRoute(navigation.read(), sessionStorage.getItem('atlas-layout-role')) : 'login').current;
  useEffect(() => {
    let active = true;
    Promise.all([import('./App.jsx'), synchronizeClock()]).then(([module]) => {
      if (active) setView(() => module.default);
    }).catch(() => {
      if (active) setStatus('error');
    });
    return () => {
      active = false;
    };
  }, [navigation]);
  useEffect(() => {
    if (!View || status !== 'loading') return;
    let frame;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const host = viewport.current;
        if (host?.firstElementChild && !host.querySelector('[data-route-loading]')) setStatus('ready');
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(viewport.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-route-loading']
    });
    check();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [View, status]);
  if (status === 'error') return <Failure appearance={appearance} />;
  return <>{status === 'loading' && <Loading layout={layout} restoring={restoring} appearance={appearance} />}<div ref={viewport} className={status === 'loading' ? 'campus-startup-stage' : undefined} inert={status !== 'ready' || undefined} aria-hidden={status !== 'ready' ? 'true' : undefined}>{View && <Boundary appearance={appearance}><View navigation={navigation} /></Boundary>}</div></>;
}
