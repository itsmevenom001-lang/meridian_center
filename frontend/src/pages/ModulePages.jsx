import React from "react";
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, CheckCircle2, Clock3, FileCheck2, Landmark, RefreshCw, ShieldCheck, Wallet, CircleDollarSign, BriefcaseBusiness, Search, Download, ClipboardCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ExceptionTable from "../components/ExceptionTable";

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const journeys = ["All journeys", "Cash & Receivables", "Agency Bill", "Carrier Settlement", "Producer Compensation", "Month-End Close"];
const severities = ["All severities", "Critical", "High", "Medium", "Low"];
const statuses = ["All statuses", "Open", "Escalated", "Resolved"];
function Metric({ label, value, note, icon, tone = "blue" }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`icon-box ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span>{note}</span></div></div>;
}
function PanelTitle({ title, description, right }) {
  return <div className="panel-title"><div><h3>{title}</h3><p>{description}</p></div>{right}</div>;
}
function FilterBar({ query, setQuery, journey, setJourney, severity, setSeverity, status, setStatus, onExport }) {
  return <div className="filters"><div className="searchbox"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, cause, agency or owner" aria-label="Search exceptions"/></div>
    <select aria-label="Filter by journey" value={journey} onChange={(e) => setJourney(e.target.value)}>{journeys.map(j => <option key={j}>{j}</option>)}</select>
    <select aria-label="Filter by severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>{severities.map(s => <option key={s}>{s}</option>)}</select>
    <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
    <button className="btn btn-secondary" onClick={onExport}><Download size={14}/> Export CSV</button>
  </div>;
}
export function OverviewPage({ data, items, onSelect, goTo }) {
  const m = data.metrics || {};
  return <>
    <div className="metric-grid">
      <Metric label="Cash position" value={money(m.cash_position)} note="Reported by demo ledger" icon={<Banknote size={18}/>} tone="blue"/>
      <Metric label="Unapplied cash" value={money(m.unapplied_cash)} note="Requires matching review" icon={<Wallet size={18}/>} tone="amber"/>
      <Metric label="Carrier settlement exposure" value={money(items.filter(e=>e.journey==="Carrier Settlement" && !e.is_duplicate_candidate && e.status!=="Resolved").reduce((s,e)=>s+e.amount,0))} note={`${m.settlements_due_48h ?? 0} due within 48 hours`} icon={<Landmark size={18}/>} tone="rose"/>
      <Metric label="Commission at review" value={money(m.commission_exposure)} note="Inputs and split rules" icon={<CircleDollarSign size={18}/>} tone="violet"/>
    </div>
    <div className="overview-grid">
      <section className="panel exposure-panel"><PanelTitle title="Exposure by finance journey" description="Open exception amounts; possible duplicates excluded" right={<button className="text-button" onClick={()=>goTo("Exception workbench")}>View workbench ↗</button>}/>
        <div className="exposure-total"><div><small>Gross unique exception exposure</small><h2>{money(data.unique_exposure)}</h2></div><span className="trend-chip"><ArrowUpRight size={14}/> Requires review</span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.journey_exposure || []} layout="vertical" margin={{top:3,right:22,left:8,bottom:0}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf0f4"/><XAxis type="number" tickFormatter={v=>`$${Math.round(v/1000)}k`} tick={{fontSize:10,fill:"#8791a1"}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="journey" width={142} tick={{fontSize:11,fill:"#5b6575"}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="amount" fill="#4569e8" radius={[0,5,5,0]} barSize={17}/></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel close-panel"><PanelTitle title="Month-end close" description="Current close cycle · synthetic demo"/>
        <div className="readiness"><div className="readiness-number">{m.close_readiness ?? 0}<small>%</small></div><div className="readiness-copy"><b>Close readiness</b><span>Target ≥ 95% before sign-off</span></div></div>
        <div className="progress"><span style={{width:`${Math.min(100,Math.max(0,m.close_readiness || 0))}%`}}/></div>
        <div className="close-stats"><div><b>{m.reconciliations_complete ?? 0}<span> / {m.reconciliations_total ?? 0}</span></b><small>Reconciliations complete</small></div><div><b>{items.filter(e=>e.journey==="Month-End Close" && e.status!=="Resolved").length}</b><small>Open close exceptions</small></div></div>
        <div className="close-callout"><AlertCircle size={17}/><span><b>Close controls need attention</b><small>Resolve breaks and attach reviewer evidence before sign-off.</small></span></div>
        <button className="btn btn-secondary full" onClick={()=>goTo("Month-end close")}>Review close tasks <span>→</span></button>
      </section>
    </div>
    <section className="panel exceptions-panel"><PanelTitle title="Priority exceptions" description="Ranked by severity and exposure" right={<button className="text-button" onClick={()=>goTo("Exception workbench")}>All exceptions ({items.length}) ↗</button>}/><ExceptionTable items={items.slice(0,5)} onSelect={onSelect}/></section>
  </>;
}
export function ExceptionWorkbenchPage({ items, onSelect, filters, setFilters, onExport }) {
  return <section className="panel workbench"><PanelTitle title="Exception workbench" description="Search, filter, inspect evidence and submit a traceable review." right={<span className="pill">{items.length} records</span>}/>
    <FilterBar {...filters} onExport={onExport}/><ExceptionTable items={items} onSelect={onSelect} detailed/>
  </section>;
}
function JourneyPage({ title, description, items, onSelect, goTo, icon, metrics = [] }) {
  return <div className="journey-page">
    <div className="metric-grid">{metrics.map(m=><Metric key={m.label} {...m}/>)}</div>
    <section className="panel journey-panel"><PanelTitle title={`${title} control queue`} description={description} right={<span className="pill">{items.length} exceptions</span>}/>
      <div className="module-summary"><span className="module-icon">{icon}</span><div><b>{items.filter(e=>e.status!=="Resolved").length} items require attention</b><p>Open an exception to inspect its source references and submit a review request. Actions are recorded in the audit trail.</p></div><button className="btn btn-secondary" onClick={()=>goTo("Exception workbench")}>Open full workbench ↗</button></div>
      <ExceptionTable items={items} onSelect={onSelect} detailed/>
    </section>
  </div>;
}
export function CashReceivablesPage(props) {
  const {data,items}=props; const m=data.metrics||{};
  return <JourneyPage {...props} title="Cash & receivables" description="Receipt matching, unapplied cash and agency-bill exceptions." icon={<Wallet size={20}/>} metrics={[
    {label:"Cash position",value:money(m.cash_position),note:"Synthetic ledger metric",icon:<Banknote size={18}/>,tone:"blue"},
    {label:"Unapplied cash",value:money(m.unapplied_cash),note:"Requires allocation review",icon:<Wallet size={18}/>,tone:"amber"},
    {label:"Cash-related exceptions",value:items.length,note:"Filtered to cash & receivables",icon:<ClipboardCheck size={18}/>,tone:"violet"}
  ]}/>;
}
export function CarrierSettlementPage(props) {
  const {data,items}=props; const m=data.metrics||{};
  return <JourneyPage {...props} title="Carrier settlement" description="Carrier statement variances, settlement deadlines and payment approval exceptions." icon={<Landmark size={20}/>} metrics={[
    {label:"Settlement exposure",value:money(items.filter(e=>!e.is_duplicate_candidate&&e.status!=="Resolved").reduce((s,e)=>s+e.amount,0)),note:"Open gross exposure; not confirmed loss",icon:<Landmark size={18}/>,tone:"rose"},
    {label:"Due within 48 hours",value:m.settlements_due_48h ?? 0,note:"Confirm cut-off in source system",icon:<Clock3 size={18}/>,tone:"amber"},
    {label:"Settlement exceptions",value:items.length,note:"Requires evidence-based review",icon:<ClipboardCheck size={18}/>,tone:"blue"}
  ]}/>;
}
export function ProducerCompensationPage(props) {
  const {data,items}=props; const m=data.metrics||{};
  return <JourneyPage {...props} title="Producer compensation" description="Commission inputs, effective-dated split rules and payout approval controls." icon={<BriefcaseBusiness size={20}/>} metrics={[
    {label:"Commission at review",value:money(m.commission_exposure),note:"Demo metric",icon:<CircleDollarSign size={18}/>,tone:"violet"},
    {label:"Compensation exceptions",value:items.length,note:"Missing inputs or split variances",icon:<ClipboardCheck size={18}/>,tone:"amber"},
    {label:"Approval control",value:"Human review",note:"No payout is executed here",icon:<ShieldCheck size={18}/>,tone:"blue"}
  ]}/>;
}
export function MonthEndClosePage(props) {
  const {data,items}=props; const m=data.metrics||{};
  return <JourneyPage {...props} title="Month-end close" description="Reconciliation breaks, close blockers and reviewer evidence completeness." icon={<FileCheck2 size={20}/>} metrics={[
    {label:"Close readiness",value:`${m.close_readiness ?? 0}%`,note:"Target at least 95%",icon:<Activity size={18}/>,tone:"blue"},
    {label:"Reconciliations complete",value:`${m.reconciliations_complete ?? 0} / ${m.reconciliations_total ?? 0}`,note:"Reported by demo ledger",icon:<CheckCircle2 size={18}/>,tone:"violet"},
    {label:"Open close exceptions",value:items.filter(e=>e.status!=="Resolved").length,note:"Evidence and feed breaks",icon:<AlertCircle size={18}/>,tone:"amber"}
  ]}/>;
}
export function AuditTrailPage({ audit, onRefresh, onExport }) {
  return <section className="panel audit-panel"><PanelTitle title="Decision & control history" description="Server-recorded review events and system activity." right={<div className="audit-actions"><button className="btn btn-secondary" onClick={onExport}><Download size={14}/> Export CSV</button><button className="btn btn-secondary" onClick={onRefresh}><RefreshCw size={14}/> Refresh history</button></div>}/>
    {!audit.length && <div className="empty">No audit events have been recorded yet.</div>}
    {audit.map(a=><div className="audit-row" key={a.id}><span className="audit-dot"/><div className="audit-main"><b>{(a.action||"EVENT").replaceAll("_"," ")}</b><p>{a.detail}</p><small>{a.actor} · {a.target} · {a.id}</small></div><time>{new Date(a.time).toLocaleString()}</time></div>)}
  </section>;
}
