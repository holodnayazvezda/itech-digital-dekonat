export function ReplyAction({ children, className = "irishka-action-chip", action, detail, onAction, actionHref }) {
  const href = actionHref?.(action, detail);
  if (!href) return <button type="button" className={className} onClick={() => onAction(action, detail)}>{children}</button>;
  return <a className={className} href={href} onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    onAction(action, detail);
  }}>{children}</a>;
}

export function ReplyPanelHeading({ icon: Icon, children, detail }) {
  return <div className="irishka-panel-heading">
    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
    <div><h3>{children}</h3>{detail && <p>{detail}</p>}</div>
  </div>;
}
