import type { Metric } from "./calculations";

export const numberLabel = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
export function HorizontalBars({ rows }: { rows: { key: string; label: string; hours: number; entries: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.hours));
  return <figure>
    <figcaption>Planned hours, with overlaps merged within each life area</figcaption>
    {!rows.length && <p className="muted">No planned time in this period.</p>}
    <div className="analytics-horizontal" role="img" aria-label={rows.length ? rows.map(row => `${row.label}: ${numberLabel(row.hours)} planned hours`).join("; ") : "No planned hours"}>
      {rows.map(row => <div className="analytics-bar-row" key={row.key} aria-hidden="true"><span>{row.label}</span><div className="analytics-bar-track"><span style={{ width: `${row.hours / max * 100}%` }} /></div><strong>{numberLabel(row.hours)} h</strong></div>)}
    </div>
    <details><summary>View durations and entry counts</summary><div className="analytics-table"><table><thead><tr><th>Life area</th><th>Planned hours</th><th>Included entries</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{numberLabel(row.hours)}</td><td>{row.entries}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
export function Columns({ rows, unit, label }: { rows: { date: string; value: number }[]; unit: string; label: string }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <figure>
    <figcaption>{label}</figcaption>
    <div className="analytics-column-scroll" role="img" aria-label={`${label}. ${rows.length} local days, including zero days. Values available in the data table.`}>
      <div className="analytics-columns" style={{ minWidth: Math.max(280, rows.length * 48) }} aria-hidden="true">{rows.map(row => <div className="analytics-column" key={row.date} title={`${row.date}: ${numberLabel(row.value)} ${unit}`}><strong>{numberLabel(row.value)}</strong><div className="analytics-column-track"><span style={{ height: `${row.value / max * 100}%` }} /></div><span>{row.date.slice(5)}</span></div>)}</div>
    </div>
    {!rows.some(row => row.value) && <p className="muted">No {unit} recorded for this period.</p>}
    <details><summary>View daily values</summary><div className="analytics-table"><table><thead><tr><th>Local date</th><th>{unit}</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{numberLabel(row.value)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
export function StackedBar({ rows, total, label }: { rows: Metric[]; total: number; label: string }) {
  return <figure>
    <figcaption>{label}</figcaption>
    <div className="analytics-stacked" role="img" aria-label={total ? rows.map(row => `${row.label}: ${row.count}, ${row.percent.toFixed(1)} percent`).join("; ") : "No eligible tasks"}>{rows.filter(row => row.count).map(row => <span key={row.key} className={"analytics-segment segment-" + row.key} style={{ flexGrow: row.percent }} aria-hidden="true" />)}</div>
    <div className="analytics-table"><table><thead><tr><th>Outcome</th><th>Tasks</th><th>Share</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row"><span className={"analytics-swatch segment-" + row.key} aria-hidden="true" />{row.label}</th><td>{row.count}</td><td>{row.percent.toFixed(1)}%</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{total}</td><td>{total ? "100.0%" : "0.0%"}</td></tr></tfoot></table></div>
    {!total && <p className="muted">No tasks meet this chart’s population rules in this period.</p>}
  </figure>;
}
