import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowUpRight, Bell, Bot, BriefcaseBusiness, Check, ChevronDown,
  FileCheck2, Filter, Landmark, LayoutDashboard, ListTodo, MessageSquareText, RefreshCw,
  ShieldCheck, Sparkles, Wallet, X, Download, UserRound, Clock3, CircleDollarSign, CalendarClock, Banknote
} from "lucide-react";
import { api } from "./api";
import ExceptionTable from "./components/ExceptionTable";
import { AgencyBillingPage, PolicyPipelinePage, RevenueIntelligencePage } from "./pages/FinancePages";
import {
  AuditTrailPage, CashReceivablesPage, CarrierSettlementPage, ExceptionWorkbenchPage,
  MonthEndClosePage, OverviewPage, ProducerCompensationPage
} from "./pages/ModulePages";

const nav = [
  ["Overview", LayoutDashboard, "/"],
  ["Exception workbench", ListTodo, "/exceptions"],
  ["Cash & receivables", Wallet, "/cash-receivables"],
  ["Carrier settlement", Landmark, "/carrier-settlement"],
  ["Producer compensation", BriefcaseBusiness, "/producer-compensation"],
  ["Month-end close", FileCheck2, "/month-end-close"],
  ["Revenue intelligence", CircleDollarSign, "/revenue"],
  ["Policy pipeline", CalendarClock, "/policy-pipeline"],
  ["Agency billing", Banknote, "/agency-billing"],
  ["Audit trail", ShieldCheck, "/audit"],
];
const journeyForPage = {
  "Cash & receivables": "Cash & Receivables",
  "Carrier settlement": "Carrier Settlement",
  "Producer compensation": "Producer Compensation",
  "Month-end close": "Month-End Close",
};
const pageForPath = Object.fromEntries(nav.map(([name, , path]) => [path, name]));
const pathForPage = Object.fromEntries(nav.map(([name, , path]) => [name, path]));
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function IconBox({ children, tone = "blue" }) {
  return <span className={`icon-box ${tone}`}>{children}</span>;
}
function App() {
  const [data, setData] = useState(null);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [billingItems, setBillingItems] = useState([]);
  const [audit, setAudit] = useState([]);
  const [health, setHealth] = useState(null);
  const [page, setPage] = useState(() => pageForPath[window.location.pathname] || "Overview");
  const [journey, setJourney] = useState(() => journeyForPage[pageForPath[window.location.pathname]] || "All journeys");
  const [severity, setSeverity] = useState("All severities");
  const [status, setStatus] = useState("All statuses");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [persona, setPersona] = useState("CFO");
  const [question, setQuestion] = useState("Which settlements are at risk and why?");
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [d, a, h, fs, ps, bs] = await Promise.all([api.dashboard(), api.audit(), api.health(), api.financeSummary(), api.policies(), api.agencyBilling()]);
      setData(d);
      setAudit(a.items || []);
      setHealth(h);
      setFinanceSummary(fs);
      setPolicies(ps.items || []);
      setBillingItems(bs.items || []);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) setToast(`Backend unavailable: ${err.message}. Start FastAPI on port 8000.`);
      setHealth({ status: "offline" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const onPopState = () => {
      const next = pageForPath[window.location.pathname] || "Overview";
      setPage(next);
      setJourney(journeyForPage[next] || "All journeys");
      setSelected(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const goTo = useCallback((nextPage) => {
    const path = pathForPage[nextPage] || "/";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setPage(nextPage);
    setJourney(journeyForPage[nextPage] || "All journeys");
    setQuery("");
    setSeverity("All severities");
    setStatus("All statuses");
    setSelected(null);
    setWorkspaceOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, []);

  const allExceptions = data?.exceptions || [];
  const items = useMemo(() => {
    let rows = allExceptions;
    if (journey !== "All journeys") rows = rows.filter((e) => e.journey === journey);
    if (severity !== "All severities") rows = rows.filter((e) => e.severity === severity);
    if (status !== "All statuses") rows = rows.filter((e) => e.status === status);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      rows = rows.filter((e) => [e.id, e.title, e.owner, e.agency, e.cause, e.control, e.journey, e.status].join(" ").toLowerCase().includes(q));
    }
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...rows].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || (b.amount || 0) - (a.amount || 0));
  }, [allExceptions, journey, severity, status, query]);

  async function ask(q = question) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await api.copilot({ question: q.trim(), persona }));
    } catch (err) {
      setAnswer({ answer: `The copilot request failed: ${err.message}. Check that the FastAPI backend is running.`, mode: "offline" });
    } finally {
      setBusy(false);
    }
  }

  async function review(exception, action = "REQUEST_REVIEW") {
    const notes = {
      REQUEST_REVIEW: "Please review evidence, cause and control impact; no financial action is authorized.",
      ESCALATE: "Escalated from command center for urgent owner review.",
      MARK_DUPLICATE_CANDIDATE: "Marked for duplicate validation; reviewer confirmation required.",
    };
    try {
      const result = await api.review(exception.id, { reviewer: persona, action, note: notes[action] || notes.REQUEST_REVIEW });
      setToast(`${exception.id}: ${result.message || "Action recorded."}`);
      setSelected(null);
      await load(true);
    } catch (err) {
      setToast(`Could not record action: ${err.message}`);
    }
  }

  async function handlePolicyAction(policy, action) {
    const note = action === "FLAG_CARRIER_LIMIT" ? "Premium compared with configured carrier authority; route for authorized review." : action === "FLAG_CANCELLATION_RISK" ? "Review premium collection and cancellation/lapse exposure; no cancellation is initiated." : action === "REQUEST_CARRIER_STATEMENT" ? "Request carrier statement and reconcile policy-level premium and commission." : action === "REQUEST_RENEWAL_CONTACT" ? "Request renewal outreach and confirm coverage continuity." : action === "REQUEST_COMMISSION_RECOVERY" ? "Validate expected-versus-received commission against contract and carrier statement." : "Request human review.";
    try { const result = await api.policyAction(policy.id, { reviewer: persona, action, note }); setToast(result.message); await load(true); }
    catch (err) { setToast(`Policy action failed: ${err.message}`); }
  }
  async function handleBillingAction(row, action) {
    const note = `Follow-up for ${row.policy_id}; verify source evidence and due date before financial action.`;
    try { const result = await api.billingAction(row.id, { reviewer: persona, action, note }); setToast(result.message); await load(true); }
    catch (err) { setToast(`Billing action failed: ${err.message}`); }
  }

  async function resetDemo() {
    const confirmed = window.confirm("Reset the synthetic demo ledger and its audit history? This does not affect external financial systems.");
    if (!confirmed) return;
    try {
      await api.reset();
      setQuery(""); setSeverity("All severities"); setStatus("All statuses");
      setToast("Synthetic demo records and audit history were reset.");
      await load(true);
    } catch (err) {
      setToast(`Reset failed: ${err.message}`);
    }
  }

  function exportCsv() {
    const cols = ["id", "title", "journey", "severity", "amount", "currency", "age_days", "owner", "agency", "status", "cause", "control", "sources"];
    const escape = (v) => `"${String(Array.isArray(v) ? v.join("; ") : (v ?? "")).replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...items.map((row) => cols.map((key) => escape(row[key])).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `meridian-exceptions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setToast(`Exported ${items.length} exception record(s) to CSV.`);
  }

  function exportAuditCsv() {
    const cols = ["id", "time", "actor", "action", "target", "detail"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...audit.map((row) => cols.map((key) => escape(row[key])).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `meridian-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setToast(`Exported ${audit.length} audit event(s) to CSV.`);
  }

  const filters = { query, setQuery, journey, setJourney, severity, setSeverity, status, setStatus };
  const metrics = data?.metrics || {};
  const titleCopy = {
    "Overview": "One operating view of material exceptions, settlement risk and close readiness.",
    "Exception workbench": "Investigate exceptions with traceable evidence and controlled next steps.",
    "Cash & receivables": "Review receipt matching, unapplied cash and agency-bill control breaks.",
    "Carrier settlement": "Monitor carrier statement variances, settlement exposure and cut-off risk.",
    "Producer compensation": "Investigate commission inputs, split rules and payout approval exceptions.",
    "Month-end close": "Track reconciliation completion, close blockers and supporting evidence.",
    "Revenue intelligence": "Find revenue leakage in missing transactions, carrier statements and commission recovery.",
    "Policy pipeline": "Monitor renewal dates, premium authority limits and cancellation or lapse risks.",
    "Agency billing": "Reconcile premium collections, commission received and carrier payables.",
    "Audit trail": "Inspect server-recorded decisions, review requests and control events."
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand brand-button" onClick={() => goTo("Overview")} aria-label="Go to overview"><div className="brand-mark"><Activity size={21}/></div><div><strong>meridian</strong><span>FINANCE OPERATIONS</span></div></button>
      <div className="workspace-wrap">
        <button className="workspace" onClick={() => setWorkspaceOpen(v => !v)} aria-expanded={workspaceOpen}><span className="workspace-dot"></span><div><b>Meridian Brokerage Group</b><small>Enterprise workspace</small></div><ChevronDown size={15}/></button>
        {workspaceOpen && <div className="popover-menu"><b>Workspace</b><p>Synthetic demonstration tenant</p><span className="menu-note">No external ledger connection configured.</span></div>}
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(([name, Icon, path]) => <button key={name} onClick={() => goTo(name)} className={page === name ? "active" : ""} aria-current={page === name ? "page" : undefined}><Icon size={17}/><span>{name}</span>{name === "Exception workbench" && <em>{data?.open_exceptions ?? "—"}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><ShieldCheck size={17}/><b>Controls in place</b><p>Human approval required for payments, journals and producer payouts.</p><span><i/> Guardrails active</span></div>
        <button className="user-row user-row-button" onClick={() => setProfileOpen(v => !v)}><div className="avatar">{persona.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><div><b>{persona}</b><small>Finance operations · Demo</small></div><ChevronDown size={14}/></button>
        {profileOpen && <div className="popover-menu profile-menu"><b>Reviewer role</b><p>Choose the persona used in copilot prompts and review audit records.</p><select value={persona} onChange={e=>setPersona(e.target.value)}>{["CFO","Controller","Finance Operations","Accounting Manager","Treasury","Shared Services","Agency Finance"].map(p=><option key={p}>{p}</option>)}</select></div>}
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="crumb"><button onClick={() => goTo("Overview")}>Finance operations</button><span>/</span><b>{page}</b></div>
        <div className="top-actions"><span className={`environment ${health?.status === "ok" ? "" : "environment-offline"}`}><i/> {health?.status === "ok" ? "API CONNECTED" : "API DISCONNECTED"}</span>
          <button className="icon-button" title="Refresh dashboard and audit data" aria-label="Refresh" onClick={() => load()}><RefreshCw size={16}/></button>
          <div className="menu-anchor"><button className="icon-button" title="Recent activity" aria-label="Notifications" onClick={() => setNotificationsOpen(v=>!v)}><Bell size={17}/>{audit.length>0&&<i className="notification-dot"/>}</button>
            {notificationsOpen && <div className="popover-menu notification-menu"><div className="menu-head"><b>Recent activity</b><button onClick={()=>goTo("Audit trail")}>View audit trail</button></div>{audit.slice(0,4).map(a=><div className="notification-item" key={a.id}><span className="audit-dot"/><div><b>{(a.action||"EVENT").replaceAll("_"," ")}</b><small>{a.target} · {new Date(a.time).toLocaleString()}</small></div></div>)}{!audit.length&&<p>No activity recorded.</p>}</div>}
          </div><div className="top-avatar">{persona.split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
        </div>
      </header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">FINANCE COMMAND CENTER <span>•</span> SYNTHETIC LEDGER</div><h1>{page === "Overview" ? "Protect cash, commission & margin" : page}</h1><p>{titleCopy[page]}</p></div>
          <div className="heading-actions"><button className="btn btn-secondary" onClick={resetDemo}><RefreshCw size={15}/> Reset demo</button><button className="btn btn-primary" onClick={() => goTo("Exception workbench")}><Filter size={15}/> Review exceptions</button></div>
        </div>
        {lastUpdated && <div className="status-strip"><div><span className="pulse"></span><b>{loading ? "Refreshing…" : health?.status === "ok" ? "Connected operating view" : "Connection lost — showing last successful data"}</b><span className="muted">Auto-refresh every 30 seconds</span></div><span>Updated {lastUpdated.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span></div>}
        {!data ? <div className="offline"><AlertCircle/> {loading ? "Loading finance data from the backend…" : "Unable to load dashboard data. Check the FastAPI backend on port 8000."}<button className="btn btn-secondary" onClick={() => load()}>Retry connection</button></div> : <>
          {page === "Overview" && <OverviewPage data={data} items={items} onSelect={setSelected} goTo={goTo}/>}
          {page === "Exception workbench" && <ExceptionWorkbenchPage items={items} onSelect={setSelected} filters={filters} onExport={exportCsv}/>}
          {page === "Cash & receivables" && <CashReceivablesPage data={data} items={items} onSelect={setSelected} goTo={goTo}/>}
          {page === "Carrier settlement" && <CarrierSettlementPage data={data} items={items} onSelect={setSelected} goTo={goTo}/>}
          {page === "Producer compensation" && <ProducerCompensationPage data={data} items={items} onSelect={setSelected} goTo={goTo}/>}
          {page === "Month-end close" && <MonthEndClosePage data={data} items={items} onSelect={setSelected} goTo={goTo}/>}
          {page === "Revenue intelligence" && <RevenueIntelligencePage summary={financeSummary} goTo={goTo}/>}
          {page === "Policy pipeline" && <PolicyPipelinePage policies={policies} summary={financeSummary} reviewPolicy={handlePolicyAction} refresh={() => load()}/>}
          {page === "Agency billing" && <AgencyBillingPage items={billingItems} reviewBilling={handleBillingAction} refresh={() => load()}/>}
          {page === "Audit trail" && <AuditTrailPage audit={audit} onRefresh={() => load()} onExport={exportAuditCsv}/>}
        </>}
        <footer><span>Meridian Finance Operations Command Center <b>·</b> Finance workflows demo build 3.0</span><span><ShieldCheck size={13}/> Human approval gates enabled</span></footer>
      </div>
    </main>

    <aside className={`copilot ${copilotOpen ? "" : "copilot-collapsed"}`}>
      <div className="copilot-head"><div className="copilot-head-icon"><Bot size={19}/></div><div><b>Finance copilot</b><small><span className="online-dot"/> Evidence-grounded assistant</small></div><button className="icon-button" onClick={()=>setCopilotOpen(v=>!v)} title={copilotOpen ? "Collapse copilot" : "Expand copilot"}>{copilotOpen ? <X size={15}/> : <MessageSquareText size={15}/>}</button></div>
      {copilotOpen && <>
        <div className="copilot-context"><Sparkles size={14}/><span>Context: current synthetic ledger, control flags & source references</span></div>
        <label className="field-label">YOUR ROLE</label><select className="persona-select" value={persona} onChange={e=>setPersona(e.target.value)}>{["CFO","Controller","Finance Operations","Accounting Manager","Treasury","Shared Services","Agency Finance"].map(p=><option key={p}>{p}</option>)}</select>
        <div className="copilot-chat"><div className="assistant-intro"><div className="bot-avatar"><Bot size={17}/></div><div><b>Finance operations copilot</b><p>Ask about exposure, likely causes and controlled next steps. Validate every recommendation against source evidence.</p></div></div>
          {answer && <div className="answer-card"><div className="answer-meta"><span className={answer.mode === "groq" ? "mode-groq" : "mode-local"}>{answer.mode === "groq" ? "GROQ · MODEL" : answer.mode === "offline" ? "API ERROR" : "LOCAL · GROUNDED"}</span>{answer.latency_ms > 0 && <span>{answer.latency_ms} ms</span>}</div><p>{answer.answer}</p>{answer.warning && <small className="warning-text">{answer.warning}</small>}{answer.evidence_ids?.length > 0 && <div className="evidence-chips">{answer.evidence_ids.map(id=><span key={id}>{id}</span>)}</div>}{answer.prompt_tokens != null && <div className="token-line">Tokens · {answer.prompt_tokens} in / {answer.completion_tokens} out</div>}</div>}
          {busy && <div className="thinking"><span/><span/><span/> Analyzing ledger evidence…</div>}
          <div className="quick-prompts"><small>SUGGESTED QUESTIONS</small>{["Compare expected commission to received commission","Which policies are due this month?","Which policies exceed carrier limits?","Which policies are at cancellation risk?","What revenue leakage should we review?","What payments are due under agency billing?","What cash is unapplied?","Which settlements are at risk?","Why may close slip?"].map(q=><button key={q} onClick={()=>{setQuestion(q);ask(q)}}>{q}<span>↗</span></button>)}</div>
        </div>
        <div className="copilot-compose"><textarea id="copilot-input" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask()}}} placeholder="Ask about cash, margin or close…"/><div className="compose-bottom"><span>Enter to send · Shift+Enter for newline</span><button disabled={busy||!question.trim()} onClick={()=>ask()} aria-label="Send question"><ArrowUpRight size={17}/></button></div></div>
        <div className="copilot-guardrail"><ShieldCheck size={14}/><span>Read-only intelligence. Payments, journals and payouts require human approval.</span></div>
      </>}
    </aside>

    {selected && <div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><span className={`severity ${(selected.severity||"low").toLowerCase()}`}>{selected.severity} priority</span><h2 id="detail-title">{selected.title}</h2><small>{selected.id} · {selected.journey}</small></div><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Close exception details"><X size={18}/></button></div>
      <div className="detail-amount"><small>Gross exception amount</small><strong>{money(selected.amount)}</strong><span>{selected.age_days} days open · {selected.agency} · Owner: {selected.owner}</span><span className="journey-tag">Status: {selected.status}</span></div>
      <div className="detail-section"><h4>Probable cause</h4><p>{selected.cause}</p></div><div className="detail-section"><h4>Control impact</h4><p>{selected.control}</p></div>
      <div className="detail-section"><h4>Linked source evidence</h4><div className="source-list">{(selected.sources||[]).map(s=><span key={s}><FileCheck2 size={13}/>{s}</span>)}</div><small className="muted">These source references belong to the synthetic demo dataset.</small></div>
      <div className="detail-section"><h4>Recommended next step</h4><p>{selected.recommendation}</p></div>
      {selected.review_note && <div className="detail-section"><h4>Existing review note</h4><p>{selected.review_note}</p></div>}
      <div className="detail-footer"><button className="btn btn-secondary" onClick={()=>review(selected,"MARK_DUPLICATE_CANDIDATE")}>Flag duplicate review</button><button className="btn btn-secondary" onClick={()=>review(selected,"ESCALATE")}>Escalate</button><button className="btn btn-primary" onClick={()=>review(selected)}>Request review <ArrowUpRight size={15}/></button></div>
      <div className="modal-note"><ShieldCheck size={14}/> Actions are recorded in the backend audit trail. No payment, journal or payout is executed.</div>
    </div></div>}
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}<button onClick={()=>setToast("")} aria-label="Dismiss message"><X size={14}/></button></div>}
  </div>;
}
export default App;
