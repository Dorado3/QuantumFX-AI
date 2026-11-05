# QuantumFX AI

**Intelligence in Every Decision. Discipline in Every Trade.**

QuantumFX AI is a single-user algorithmic trading research platform. The current milestone is a controlled paper-trading MVP.

## Current implementation

- Next.js 16 frontend dashboard.
- FastAPI backend.
- Generated demo FX price feed for software testing.
- EMA 9/21 crossover demonstration strategy.
- Simulated positions with stop-loss and take-profit.
- Position sizing from configured risk percentage.
- Daily loss circuit breaker and maximum concurrent positions.
- Open positions, closed trades, and event audit trail.

> **Important:** This version uses generated demo prices, not live broker quotes. It does not connect to MetaTrader 5 and cannot place real orders. The in-memory demo account resets when the API process restarts. Do not use its results to make investment decisions.

## Run in GitHub Codespaces

Open two terminal tabs from the repository root.

### Terminal 1 — API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Web dashboard

```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0
```

Open forwarded port **3000** in the Codespaces Ports tab. The Next.js server proxies `/api/*` requests to FastAPI on port 8000. Keep port 8000 private to the Codespace.

### Run backend tests

```bash
cd apps/api
source .venv/bin/activate
pytest -q
```

## Default demonstration rules

- Paper mode only; engine starts stopped.
- EMA 9 / EMA 21 crossover strategy.
- 0.5% equity risk per trade by default.
- 2% of initial capital daily loss limit by default.
- Maximum two simultaneous positions.
- Stop-loss and take-profit on every simulated position.
- Simulated spread/commission allowance deducted on exit.
- Risk settings can only be changed while the engine is stopped.

## Next milestones

1. Persist account state and audit records in PostgreSQL.
2. Add a real market-data provider and stale-feed protection.
3. Build deterministic backtesting with spread, commission, and slippage.
4. Add MT5 integration through a separately deployed Windows/VPS bridge. The MetaTrader 5 Python package requires a running MetaTrader 5 terminal; a Linux Codespace alone is not a suitable live execution host.
5. Add broker reconciliation, idempotent order handling, monitoring, and independent kill switches.
6. Validate out-of-sample and forward paper-trading results before considering live execution.

Never store broker passwords, API keys, or account credentials in source control or frontend environment variables.
