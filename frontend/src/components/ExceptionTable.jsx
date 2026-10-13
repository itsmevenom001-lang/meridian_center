import React from "react";
import { AlertCircle, ArrowUpRight } from "lucide-react";

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function ExceptionTable({ items = [], onSelect, detailed = false }) {
  return <div className="table-scroll"><table><thead><tr><th>EXCEPTION</th><th>JOURNEY</th><th>SEVERITY</th><th>EXPOSURE</th><th>AGE</th><th>OWNER</th>{detailed && <th>CONTROL / CAUSE</th>}<th>OPEN</th></tr></thead>
    <tbody>{items.map((e) => <tr key={e.id} onClick={() => onSelect?.(e)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect?.(e); }}>
      <td><div className="exception-name"><span className="row-icon"><AlertCircle size={15}/></span><span><b>{e.title}</b><small>{e.id} · {e.agency}{e.is_duplicate_candidate ? " · Possible duplicate" : ""}</small></span></div></td>
      <td><span className="journey-tag">{e.journey}</span></td><td><span className={`severity ${(e.severity || "low").toLowerCase()}`}><i/>{e.severity}</span></td>
      <td className="amount">{money(e.amount)}</td><td><span className={e.age_days >= 7 ? "age old" : "age"}>{e.age_days}d</span></td>
      <td><div className="owner"><span>{(e.owner || "?").split(" ").map((x) => x[0]).join("")}</span>{e.owner}</div></td>
      {detailed && <td className="cause-cell">{e.control || e.cause}</td>}
      <td><button type="button" className="row-arrow" aria-label={`Open ${e.id}`} onClick={(event) => { event.stopPropagation(); onSelect?.(e); }}><ArrowUpRight size={15}/></button></td>
    </tr>)}</tbody></table>{!items.length && <div className="empty">No exceptions match these filters.</div>}</div>;
}
