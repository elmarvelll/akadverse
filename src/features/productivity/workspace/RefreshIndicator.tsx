export function RefreshIndicator({ active, label }: { active: boolean; label: string }) {
  return <>
    <div className="productivity-refresh" data-active={active} aria-hidden="true">
      <div className="productivity-refresh-clip"><div className="productivity-refresh-content"><span className="productivity-refresh-spinner"/>{label}</div></div>
    </div>
    <span className="productivity-refresh-announcement" role="status">{active ? label : ""}</span>
  </>;
}
