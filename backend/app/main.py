import os, time, json
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from .data import get_seed
from .finance_data import get_policies, get_billing

load_dotenv()
app = FastAPI(title="Meridian Finance Operations API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("FRONTEND_ORIGIN","http://localhost:5173"),"http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
exceptions = get_seed()
audit = [{"id":"AUD-0001","time":datetime.now(timezone.utc).isoformat(),"actor":"System","action":"DEMO_DATA_LOADED","target":"finance-ledger","detail":"Deterministic synthetic records loaded; no external systems changed."}]
metrics = {"cash_position": 4826500, "unapplied_cash": 386400, "ar_over_30": 728900, "carrier_exposure": 202900, "commission_exposure": 62150, "close_readiness": 82, "reconciliations_complete": 46, "reconciliations_total": 52, "settlements_due_48h": 3, "last_refreshed": datetime.now(timezone.utc).isoformat()}
policies = get_policies()
agency_billing = get_billing()

class ReviewRequest(BaseModel):
    reviewer: str = Field(default="Finance Reviewer", min_length=2, max_length=80)
    note: str = Field(default="Review requested from command center.", max_length=1000)
    action: str = Field(default="REQUEST_REVIEW", pattern="^(REQUEST_REVIEW|MARK_DUPLICATE_CANDIDATE|ESCALATE)$")

class FinanceActionRequest(BaseModel):
    reviewer: str = Field(default="Finance Reviewer", min_length=2, max_length=80)
    action: str = Field(min_length=3, max_length=80)
    note: str = Field(default="Reviewed from finance command center.", max_length=1000)

class CopilotRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1200)
    persona: str = Field(default="CFO", max_length=60)

def audit_event(actor, action, target, detail):
    audit.insert(0, {"id":f"AUD-{len(audit)+1:04d}","time":datetime.now(timezone.utc).isoformat(),"actor":actor,"action":action,"target":target,"detail":detail})

def is_unique(e):
    return not e.get("is_duplicate_candidate", False)
def dashboard_payload():
    unique = [e for e in exceptions if is_unique(e) and e["status"] != "Resolved"]
    exposure = sum(e["amount"] for e in unique)
    by_journey = {}
    for e in unique:
        by_journey[e["journey"]] = by_journey.get(e["journey"], 0) + e["amount"]
    return {"metrics":metrics,"open_exceptions":len([e for e in exceptions if e["status"]=="Open" and is_unique(e)]),
            "unique_exposure":round(exposure,2),"critical_count":sum(e["severity"]=="Critical" for e in unique),
            "journey_exposure":[{"journey":k,"amount":round(v,2)} for k,v in sorted(by_journey.items(), key=lambda x:x[1], reverse=True)],
            "exceptions":exceptions,"audit_count":len(audit)}
@app.get("/api/health")
def health(): return {"status":"ok","service":"meridian-finance-api","groq_configured":bool(os.getenv("GROQ_API_KEY")),"model":os.getenv("GROQ_MODEL","qwen/qwen3.8-27b")}
@app.get("/api/dashboard")
def dashboard(): return dashboard_payload()
@app.get("/api/exceptions")
def list_exceptions(journey: Optional[str]=None, severity: Optional[str]=None, status: Optional[str]=None):
    rows=exceptions
    if journey and journey!="All journeys": rows=[e for e in rows if e["journey"]==journey]
    if severity and severity!="All severities": rows=[e for e in rows if e["severity"]==severity]
    if status and status!="All statuses": rows=[e for e in rows if e["status"]==status]
    return {"items":rows,"count":len(rows)}
@app.post("/api/exceptions/{exception_id}/review")
def review(exception_id: str, body: ReviewRequest):
    item=next((e for e in exceptions if e["id"]==exception_id),None)
    if not item: raise HTTPException(404,"Exception not found")
    audit_event(body.reviewer,body.action,exception_id,body.note)
    if body.action=="MARK_DUPLICATE_CANDIDATE": item["review_note"]=body.note; item["duplicate_review"]="Pending human confirmation"
    elif body.action=="ESCALATE": item["status"]="Escalated"
    else: item["review_requested"]=True
    return {"ok":True,"item":item,"message":"Review event recorded. No payment, posting, payout, or client-impacting action was executed."}
@app.get("/api/audit")
def get_audit(): return {"items":audit}
@app.post("/api/demo/reset")
def reset():
    global exceptions, audit, policies, agency_billing
    exceptions=get_seed()
    policies=get_policies()
    agency_billing=get_billing()
    audit=[]
    audit_event("System","DEMO_RESET","finance-ledger","Synthetic dataset reset.")
    return dashboard_payload()


def finance_summary_payload():
    from datetime import date
    today = date.today()
    month_prefix = today.strftime("%Y-%m")
    due_this_month = [p for p in policies if p.get("renewal_due", "").startswith(month_prefix)]
    expected = sum(p["expected_commission"] for p in policies)
    received = sum(p["commission_received"] for p in policies)
    premium = sum(p["premium"] for p in policies)
    premium_received = sum(p["premium_received"] for p in policies)
    limit_breaches = [p for p in policies if p["premium"] > p["carrier_limit"]]
    cancellation = [p for p in policies if p["policy_status"] == "Cancellation review" or (p["premium_received"] < p["premium"] and p["renewal_due"] <= (today.replace(day=min(today.day+14,28))).isoformat())]
    missing_tx = [p for p in policies if p["transaction_status"] != "Posted"]
    missing_stmt = [p for p in policies if p["commission_status"] == "Missing carrier statement"]
    recovery = sum(max(0, p["expected_commission"]-p["commission_received"]) for p in policies)
    # Potential operating-cost reduction is a scenario estimate, not booked savings.
    cost_opportunity = round(metrics["unapplied_cash"] * 0.015 + len(missing_tx) * 1250 + len(missing_stmt) * 600, 2)
    return {
      "as_of": today.isoformat(),
      "revenue": {"premium_booked": round(premium,2), "premium_received": round(premium_received,2), "premium_outstanding": round(max(0,premium-premium_received),2), "expected_commission": round(expected,2), "commission_received": round(received,2), "commission_gap": round(max(0,expected-received),2), "commission_recovery_opportunity": round(recovery,2), "missing_transactions": len(missing_tx), "missing_carrier_statements": len(missing_stmt), "carrier_limit_breaches": len(limit_breaches), "policies_due_this_month": len(due_this_month), "cancellation_risk_count": len(cancellation), "estimated_operating_cost_opportunity": cost_opportunity},
      "policies_due_this_month": due_this_month,
      "carrier_limit_breaches": limit_breaches,
      "cancellation_risks": cancellation,
      "revenue_sources": [
        {"source":"Missing transactions", "amount":round(sum(p["premium"]-p["premium_received"] for p in missing_tx),2), "count":len(missing_tx), "note":"Potential unrecorded / uncollected premium; validate source transaction."},
        {"source":"Missing carrier statements", "amount":round(sum(max(0,p["expected_commission"]-p["commission_received"]) for p in missing_stmt),2), "count":len(missing_stmt), "note":"Expected commission not confirmed against carrier statement."},
        {"source":"Commission recovery", "amount":round(recovery,2), "count":sum(1 for p in policies if p["expected_commission"]>p["commission_received"]), "note":"Expected less received; requires contract and statement validation."},
        {"source":"Premium collection gap", "amount":round(max(0,premium-premium_received),2), "count":sum(1 for p in policies if p["premium_received"]<p["premium"]), "note":"Premium not yet recorded as received; not necessarily overdue."},
        {"source":"Operating-cost opportunity", "amount":cost_opportunity, "count":len(missing_tx)+len(missing_stmt), "note":"Illustrative avoidable-rework opportunity; not booked savings."}
      ]
    }

@app.get("/api/finance/summary")
def finance_summary(): return finance_summary_payload()

@app.get("/api/policies")
def list_policies(month: Optional[str]=None, carrier: Optional[str]=None, risk: Optional[str]=None, search: Optional[str]=None):
    rows = policies
    if month: rows = [p for p in rows if p.get("renewal_due", "").startswith(month)]
    if carrier and carrier != "All carriers": rows = [p for p in rows if p["carrier"] == carrier]
    if risk and risk != "All risks": rows = [p for p in rows if p["risk"] == risk]
    if search: rows = [p for p in rows if search.lower() in json.dumps(p).lower()]
    return {"items": rows, "count": len(rows)}

@app.post("/api/policies/{policy_id}/action")
def policy_action(policy_id: str, body: FinanceActionRequest):
    policy = next((p for p in policies if p["id"] == policy_id), None)
    if not policy: raise HTTPException(404, "Policy not found")
    allowed = {"FLAG_CANCELLATION_RISK", "REQUEST_CARRIER_STATEMENT", "FLAG_CARRIER_LIMIT", "REQUEST_RENEWAL_CONTACT", "RECORD_PREMIUM_RECEIPT_REVIEW", "REQUEST_COMMISSION_RECOVERY", "MARK_REVIEWED"}
    if body.action not in allowed: raise HTTPException(400, "Unsupported policy action")
    if body.action == "FLAG_CANCELLATION_RISK": policy["policy_status"] = "Cancellation review"; policy["risk"] = "Critical"
    elif body.action == "FLAG_CARRIER_LIMIT": policy["policy_status"] = "Carrier limit review"; policy["risk"] = "Critical"
    elif body.action == "REQUEST_CARRIER_STATEMENT": policy["commission_status"] = "Statement requested"
    elif body.action == "REQUEST_RENEWAL_CONTACT": policy["renewal_contact_status"] = "Requested"
    elif body.action == "REQUEST_COMMISSION_RECOVERY": policy["recovery_status"] = "Requested for validation"
    elif body.action == "RECORD_PREMIUM_RECEIPT_REVIEW": policy["premium_review_status"] = "Receipt evidence review requested"
    else: policy["review_status"] = "Reviewed by human; no external transaction performed"
    audit_event(body.reviewer, body.action, policy_id, f"{body.note} Current policy status: {policy.get('policy_status')}; no external carrier, billing or payment system was changed.")
    return {"ok": True, "item": policy, "message": f"{body.action.replace('_',' ').title()} recorded for {policy_id}. No external transaction was executed."}

@app.get("/api/agency-billing")
def list_agency_billing(status: Optional[str]=None, search: Optional[str]=None):
    rows = agency_billing
    if status and status != "All statuses": rows = [r for r in rows if r["status"] == status]
    if search: rows = [r for r in rows if search.lower() in json.dumps(r).lower()]
    return {"items": rows, "count": len(rows)}

@app.post("/api/agency-billing/{billing_id}/action")
def billing_action(billing_id: str, body: FinanceActionRequest):
    row = next((r for r in agency_billing if r["id"] == billing_id), None)
    if not row: raise HTTPException(404, "Agency billing item not found")
    allowed = {"REQUEST_PREMIUM_COLLECTION", "REQUEST_COMMISSION_RECOVERY", "REQUEST_CARRIER_STATEMENT", "REQUEST_REVIEW"}
    if body.action not in allowed: raise HTTPException(400, "Unsupported agency-billing action")
    row["last_action"] = body.action
    row["last_action_status"] = "Queued for human follow-up"
    audit_event(body.reviewer, body.action, billing_id, f"{body.note} Follow-up queued only; no cash receipt, commission recovery, invoice, or payment was posted.")
    return {"ok": True, "item": row, "message": f"Follow-up recorded for {billing_id}; no financial posting occurred."}

def fallback_answer(question, persona):
    q=question.lower()
    unique=[e for e in exceptions if is_unique(e) and e["status"] in ("Open","Escalated")]
    fs = finance_summary_payload()
    rev = fs["revenue"]
    # Route compound premium/cash/commission questions to the combined revenue view,
    # rather than the generic unapplied-cash answer below.
    if "cash" in q and any(term in q for term in ["premium", "commission", "revenue", "received"]):
        return f"Combined synthetic finance view: premium booked {rev['premium_booked']:,.0f}; premium received {rev['premium_received']:,.0f}; premium outstanding {rev['premium_outstanding']:,.0f}; expected commission {rev['expected_commission']:,.0f}; commission received {rev['commission_received']:,.0f}; commission gap {rev['commission_gap']:,.0f}. The dashboard separately reports ${metrics['unapplied_cash']:,.0f} as unapplied cash. Match bank receipts, policy transactions and carrier statements before posting or recognizing amounts."
    if "agency bill" in q or "agency billing" in q or "pay to the insurance company" in q or "payable to carrier" in q or "carrier payable" in q:
        rows = "; ".join(f"{r['id']} {r['insured']}: carrier payable ${r['agency_payable']:,.0f}, due {r['due_date']}, status {r['status']}" for r in agency_billing)
        return f"Agency-bill review: {rows}. These are synthetic gross payable indicators; confirm collected premium, contractual commission, carrier statement and due date before payment. No payment is initiated by the copilot."
    if "unapplied" in q or "cash" in q:
        chosen=[e for e in unique if "Cash" in e["journey"]]
        return f"Dashboard reports ${metrics['unapplied_cash']:,.0f} in unapplied cash. The top linked exception is {chosen[0]['id']} ({chosen[0]['title']}) for ${chosen[0]['amount']:,.0f}, aged {chosen[0]['age_days']} days. Evidence: {', '.join(chosen[0]['sources'])}. Verify remittance-to-invoice matching before any cash application."
    if any(term in q for term in ["carrier limit", "premium limit", "limit exceeded", "exceed carrier", "cancellation", "cancelled", "cancel risk", "cancellation risk", "lapse risk"]):
        breaches = fs["carrier_limit_breaches"]
        risks = fs["cancellation_risks"]
        btext = "; ".join(f"{p['id']} {p['insured']}: premium ${p['premium']:,.0f} vs carrier limit ${p['carrier_limit']:,.0f} (excess ${p['premium']-p['carrier_limit']:,.0f})" for p in breaches)
        rtext = "; ".join(f"{p['id']} {p['insured']}: premium received ${p['premium_received']:,.0f}/${p['premium']:,.0f}, renewal {p['renewal_due']}, status {p['policy_status']}" for p in risks)
        return f"There are {len(breaches)} synthetic policies above the configured carrier limit. {btext}. Cancellation/lapse review candidates: {rtext}. Control recommendation: block binding/renewal approval when premium exceeds authority, reconcile receivables, issue timely notices through approved workflows, and obtain a documented carrier override. This demo flags risk; it cannot cancel or reinstate a policy."
    if "settlement" in q or "carrier" in q or "payment" in q:
        chosen=[e for e in unique if e["journey"]=="Carrier Settlement"]
        total=sum(e["amount"] for e in chosen)
        return f"There are {len(chosen)} open carrier-settlement exceptions representing ${total:,.0f} in listed exposure. Nearest cut-off: {next((e['control'] for e in chosen if 'cut-off' in e['control'].lower()), 'confirm cut-offs with the settlement calendar')}. Review {', '.join(e['id'] for e in chosen)}. This is exposure, not a confirmed cash loss; payment release remains outside this demo."
    if "close" in q or "reconcil" in q:
        chosen=[e for e in unique if e["journey"]=="Month-End Close"]
        return f"Close readiness is {metrics['close_readiness']}%, with {metrics['reconciliations_complete']} of {metrics['reconciliations_total']} reconciliations complete. Open close-linked breaks: {', '.join(e['id'] for e in chosen)}. Late bank feed and missing reviewer evidence are the stated causes. Complete the feed refresh and evidence review before sign-off."
    if any(term in q for term in ["commission", "recovery", "expected comm"]):
        gaps = sorted([p for p in policies if p["expected_commission"] > p["commission_received"]], key=lambda p:p["expected_commission"]-p["commission_received"], reverse=True)
        lines = "; ".join(f"{p['id']} {p['insured']}: expected ${p['expected_commission']:,.0f}, received ${p['commission_received']:,.0f}, gap ${p['expected_commission']-p['commission_received']:,.0f} ({p['commission_status']})" for p in gaps[:5])
        return f"Across the synthetic policy register, expected commission is ${rev['expected_commission']:,.0f}; recorded commission received is ${rev['commission_received']:,.0f}; gross gap is ${rev['commission_gap']:,.0f}. Largest gaps: {lines}. Validate rates, endorsements, cancellations and carrier statements before treating gaps as recoverable revenue."
    if any(term in q for term in ["due this month", "policies due", "renewal due", "pipeline", "proposal pipeline"]):
        due = fs["policies_due_this_month"]
        total = sum(p["premium"] for p in due)
        rows = "; ".join(f"{p['id']} {p['insured']} due {p['renewal_due']} premium ${p['premium']:,.0f} status {p['policy_status']} risk {p['risk']}" for p in sorted(due,key=lambda p:p['renewal_due']))
        return f"{len(due)} synthetic policies are due for renewal this month ({datetime.now().strftime('%B %Y')}); their gross written premium totals ${total:,.0f}. Policy pipeline: {rows}. This dataset contains renewal records, not a CRM proposal pipeline; proposal-stage dates need a CRM integration. Confirm renewals and bind authority with the carrier before treating pipeline as booked revenue."
    if any(term in q for term in ["carrier limit", "premium limit", "limit exceeded", "cancellation", "cancelled", "cancel risk", "cancellation risk"]):
        breaches = fs["carrier_limit_breaches"]
        risks = fs["cancellation_risks"]
        btext = "; ".join(f"{p['id']} {p['insured']}: premium ${p['premium']:,.0f} vs carrier limit ${p['carrier_limit']:,.0f} (excess ${p['premium']-p['carrier_limit']:,.0f})" for p in breaches)
        rtext = "; ".join(f"{p['id']} {p['insured']}: premium received ${p['premium_received']:,.0f}/${p['premium']:,.0f}, renewal {p['renewal_due']}, status {p['policy_status']}" for p in risks)
        return f"There are {len(breaches)} synthetic policies above the configured carrier limit. {btext}. Cancellation/lapse review candidates: {rtext}. Control recommendation: block binding/renewal approval when premium exceeds authority, reconcile receivables, issue timely notices through approved workflows, and obtain a documented carrier override. This demo flags risk; it cannot cancel or reinstate a policy."
    if any(term in q for term in ["revenue", "operating cost", "reduce cost", "cost reduction", "revenue source", "missing transaction", "missing carrier statement"]):
        parts = "; ".join(f"{x['source']}: ${x['amount']:,.0f} across {x['count']} items" for x in fs["revenue_sources"])
        return f"Revenue and leakage review based on synthetic records: expected commission ${rev['expected_commission']:,.0f}, commission received ${rev['commission_received']:,.0f}, commission gap ${rev['commission_gap']:,.0f}; premium received ${rev['premium_received']:,.0f} of ${rev['premium_booked']:,.0f}; premium outstanding ${rev['premium_outstanding']:,.0f}. Indicators: {parts}. Operating-cost opportunity is an illustrative estimate, not booked savings. Reconcile source transactions, statements and recovery terms before recognition."
    if "agency bill" in q or "agency billing" in q or "pay to the insurance company" in q or "payable to carrier" in q:
        rows = "; ".join(f"{r['id']} {r['insured']}: carrier payable ${r['agency_payable']:,.0f}, due {r['due_date']}, status {r['status']}" for r in agency_billing)
        return f"Agency-bill review: {rows}. These are synthetic gross payable indicators; confirm collected premium, contractual commission, carrier statement and due date before payment. No payment is initiated by the copilot."
    ranked=sorted(unique,key=lambda e:(e["severity"]=="Critical",e["amount"]),reverse=True)[:4]
    return "Based on the synthetic exception ledger, prioritise " + "; ".join(f"{e['id']} {e['title']} (${e['amount']:,.0f}, {e['severity']}, owner {e['owner']})" for e in ranked) + ". Amounts are gross exception amounts and may not equal realized loss. Check linked source references and obtain the designated human approval before any financial action."

@app.post("/api/copilot")
def copilot(body: CopilotRequest):
    context={"metrics":metrics,"finance_summary":finance_summary_payload(),"policies":policies,"agency_billing":agency_billing,"exceptions":[{k:e.get(k) for k in ["id","title","journey","severity","amount","age_days","owner","agency","status","cause","control","sources","recommendation","is_duplicate_candidate"]} for e in exceptions]}
    key=os.getenv("GROQ_API_KEY","").strip()
    model=os.getenv("GROQ_MODEL","qwen/qwen3.8-27b")
    if key:
        try:
            from groq import Groq
            start=time.perf_counter()
            client=Groq(api_key=key)
            response=client.chat.completions.create(
                model=model,
                temperature=0.15,
                messages=[
                    {"role":"system","content":"You are Meridian Brokerage Group's finance operations copilot. Use only supplied synthetic context including policy register, renewal dates, carrier limits, premium receipts, commission expectations/receipts and agency-bill payables. Be concise, evidence-grounded, persona-aware, and explicit about assumptions. Cite exception IDs and source references. Distinguish gross exposure from confirmed loss and do not infer a payment or posting occurred. Never execute or authorize payments, journals, payouts, or client-impacting actions; recommend human review. If evidence is missing, say so."},
                    {"role":"user","content":f"Persona: {body.persona}\nQuestion: {body.question}\nContext JSON: {json.dumps(context)}"}
                ])
            usage=getattr(response,"usage",None)
            answer=response.choices[0].message.content or fallback_answer(body.question,body.persona)
            return {"answer":answer,"model":model,"mode":"groq","latency_ms":round((time.perf_counter()-start)*1000),"prompt_tokens":getattr(usage,"prompt_tokens",None),"completion_tokens":getattr(usage,"completion_tokens",None),"evidence_ids":[e["id"] for e in exceptions if e["id"] in answer]}
        except Exception as exc:
            return {"answer":fallback_answer(body.question,body.persona),"model":model,"mode":"fallback","warning":f"Groq call failed ({type(exc).__name__}); showing deterministic evidence-based fallback.","latency_ms":0,"prompt_tokens":None,"completion_tokens":None,"evidence_ids":[]}
    return {"answer":fallback_answer(body.question,body.persona),"model":model,"mode":"fallback","warning":"GROQ_API_KEY is not configured; showing deterministic evidence-based fallback.","latency_ms":0,"prompt_tokens":None,"completion_tokens":None,"evidence_ids":[]}
