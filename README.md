# Meridian Brokerage Finance Operations Command Center

A local interactive demo for synthetic brokerage-finance operations: URL-routed module pages for cash, receivables, carrier settlement, producer compensation, close readiness, prioritized exceptions, audit history, and a Groq-powered finance copilot.

## Stack
- Backend: Python 3.11+ / FastAPI / Pydantic
- Frontend: React + Vite
- LLM: Groq API; configurable model in `.env` (default `qwen/qwen3.8-27b`)
- Data: deterministic synthetic in-memory dataset; no real financial data is used

## Requirements
- Python 3.11+ recommended
- Node.js 20+ and npm
- Groq API key (optional; dashboard works without it, but copilot uses a grounded fallback)

## Setup in VS Code (Windows PowerShell)

Open this folder in VS Code, then use two terminals.

### 1) Backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit backend\.env and add your GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```
Use Python 3.11 or newer (your installed Python is selected by `py`). If environment creation fails, check detected versions with `py -0p` and install a supported Python version.

### 2) Frontend (second terminal)
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
Open the local URL printed by Vite (usually http://localhost:5173). Frontend routes are served by Vite during development; use the sidebar to move between modules.

### macOS/Linux quick start
Backend: `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env && uvicorn app.main:app --reload --port 8000`
Frontend: `cd frontend && npm install && npm run dev`

## What is implemented

- Dedicated browser routes: `/`, `/exceptions`, `/cash-receivables`, `/carrier-settlement`, `/producer-compensation`, `/month-end-close`, `/revenue`, `/policy-pipeline`, `/agency-billing`, and `/audit`; browser back/forward navigation is supported.
- All module pages load records from the FastAPI API. The dashboard refreshes automatically every 30 seconds and has a manual refresh action.
- Exception workbench supports search, journey/severity/status filters, CSV export, clickable details, review requests, duplicate-review flags and escalation.
- Workspace, reviewer-role, notifications, copilot collapse/expand, reset confirmation and audit refresh controls have working actions; no alert-only placeholder controls remain.
- Review actions call the backend and are recorded in its audit trail. A review request or escalation is not a payment, journal posting, or producer payout.
- Executive dashboard with synthetic cash position, unapplied cash, receivables aging, settlement exposure, commission exposure, and close readiness.
- Exception workbench filters by journey and severity, with source references, age, amount, owner, probable cause, control impact, and evidence.
- Review workflow: prepare a review task and append an audit event. It does **not** issue payments, post ledger entries, or change compensation.
- Copilot endpoint with context from dashboard metrics, exception records, synthetic policies, renewal dates, carrier limits, premium receipts, expected/received commission and agency-bill records. If `GROQ_API_KEY` is not configured or the model call fails, a local evidence-based response is returned.
- Model call latency and token usage are captured when returned by the Groq API.
- Synthetic data can be regenerated with `POST /api/demo/reset`.

## API endpoints
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/exceptions`
- `POST /api/exceptions/{exception_id}/review`
- `GET /api/audit`
- `POST /api/copilot`
- `POST /api/demo/reset`

## Model configuration
The default is `qwen/qwen3.8-27b`. Groq model availability and exact model IDs can change by account. If your Groq console lists a different Qwen model ID, update `GROQ_MODEL` in `backend/.env`. Do not paste API keys into source code or commit `.env`.

## Important guardrails
This is a demonstration scaffold, not a production accounting system. All records are synthetic and in-memory (they reset when the backend restarts). No payment, journal, producer payout, or client-impacting action is executed. Human review is mandatory. Before production use, add authenticated identity, role-based access, durable database storage, encrypted secrets, idempotency, data retention controls, source-system integrations, and formal control testing.

## Operational limitations

This is a functional end-to-end demo, not a production-connected finance system. Records are synthetic and in-memory, so they reset when the backend restarts. A connected API and UI do not mean real bank/carrier/accounting transactions are being executed. Production use requires authentication, role-based permissions, persistent database storage, source-system integrations, audit retention, monitoring, idempotency, and approval controls. Configure `VITE_API_BASE_URL` in a frontend `.env` file only if your backend is hosted at a different base URL; the default is `http://localhost:8000/api`.


## Revenue, policy and agency-bill workflows (build 3.0)

- Revenue intelligence: expected vs received commission, commission gap/recovery opportunities, premium booked vs collected, missing transaction indicators, missing carrier statement indicators, and an explicitly illustrative operating-cost opportunity estimate.
- Policy pipeline: renewal-month, carrier, risk and search filters; policy-level premium and commission comparison; carrier authority limit breaches; renewal dates; premium receipt shortfalls; cancellation/lapse review flags; CSV export.
- Carrier authority controls: flags policies whose synthetic premium exceeds the configured carrier limit. The application recommends a documented approval / carrier override before binding or renewal; it does not bind or cancel policies.
- Agency billing: compares premium due vs received, commission expected vs received, due dates, status, and indicative gross carrier payable. Follow-up actions queue human review and are written to audit.
- Copilot sample questions include: “Compare expected commission to received commission”, “Which policies are due this month?”, “Which policies exceed carrier limits?”, “Which policies are at cancellation risk?”, “What revenue leakage should we review?”, and “What carrier payments are due?”
- New APIs: `GET /api/finance/summary`, `GET /api/policies`, `POST /api/policies/{policy_id}/action`, `GET /api/agency-billing`, and `POST /api/agency-billing/{billing_id}/action`.

All policy, premium, commission, payable and renewal data in this package is synthetic and illustrative. Date filters use the server's current month; seeded renewal dates are examples. The operating-cost opportunity is a heuristic estimate, not actual savings. Connect a policy administration system, carrier statements, CRM proposal pipeline, bank/commission receipts and general ledger before making operational or financial decisions.
