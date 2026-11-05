from __future__ import annotations
import asyncio
import random
from collections import deque
from datetime import datetime, timezone
from typing import Literal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

APP_VERSION = "0.1.0"
STARTING_CAPITAL = 1000.0
MAX_OPEN_POSITIONS = 2
TICK_SECONDS = 3
app = FastAPI(title="QuantumFX AI API", version=APP_VERSION, description="Paper-trading MVP. Demo prices only; no broker orders are sent.")

class ControlRequest(BaseModel):
    action: Literal["start", "stop"]

class RiskSettings(BaseModel):
    risk_per_trade_pct: float = Field(default=0.5, ge=0.1, le=1.0)
    daily_loss_limit_pct: float = Field(default=2.0, ge=0.5, le=5.0)

class Market:
    def __init__(self, symbol: str, price: float):
        self.symbol = symbol
        self.price = price
        self.history = deque([price * (1 + random.uniform(-0.0015, 0.0015)) for _ in range(60)], maxlen=120)
        self.previous_fast = self.ema(9)
        self.previous_slow = self.ema(21)

    def ema(self, period: int) -> float:
        values = list(self.history)
        if not values:
            return self.price
        alpha = 2 / (period + 1)
        result = values[0]
        for value in values[1:]:
            result = alpha * value + (1 - alpha) * result
        return result

    def tick(self) -> None:
        # Generated price movement for development only; this is not a live feed.
        self.price = max(0.0001, self.price * (1 + random.uniform(-0.00012, 0.00012) + random.gauss(0, 0.00022)))
        self.history.append(self.price)

class Engine:
    def __init__(self) -> None:
        self.markets = {"EURUSD": Market("EURUSD", 1.0850), "GBPUSD": Market("GBPUSD", 1.2700), "AUDUSD": Market("AUDUSD", 0.6550)}
        self.balance = STARTING_CAPITAL
        self.equity = STARTING_CAPITAL
        self.running = False
        self.mode = "PAPER"
        self.started_at = None
        self.trades: list[dict] = []
        self.open_positions: dict[str, dict] = {}
        self.events: deque[dict] = deque(maxlen=50)
        self.risk = RiskSettings()
        self.daily_realised = 0.0
        self.daily_key = datetime.now(timezone.utc).date().isoformat()
        self.tick_count = 0
        self.task: asyncio.Task | None = None
        self.add_event("Engine initialised. Paper mode only; simulated feed active.")

    def add_event(self, message: str, level: str = "info") -> None:
        self.events.appendleft({"time": datetime.now(timezone.utc).isoformat(), "message": message, "level": level})

    def reset_daily_if_needed(self) -> None:
        today = datetime.now(timezone.utc).date().isoformat()
        if today != self.daily_key:
            self.daily_key = today
            self.daily_realised = 0.0
            self.add_event("New UTC trading day: daily loss counter reset.")

    def unrealised_pnl(self) -> float:
        total = 0.0
        for symbol, position in self.open_positions.items():
            price = self.markets[symbol].price
            direction = 1 if position["side"] == "BUY" else -1
            total += (price - position["entry_price"]) * direction * position["units"]
        return total

    def refresh_equity(self) -> None:
        self.equity = self.balance + self.unrealised_pnl()

    def daily_limit_hit(self) -> bool:
        return self.daily_realised <= -(STARTING_CAPITAL * self.risk.daily_loss_limit_pct / 100)

    def market_snapshot(self) -> list[dict]:
        result = []
        for symbol, market in self.markets.items():
            fast, slow = market.ema(9), market.ema(21)
            trend = "BULLISH" if fast > slow else "BEARISH" if fast < slow else "NEUTRAL"
            result.append({"symbol": symbol, "price": round(market.price, 5), "change_pct": round((market.price / list(market.history)[0] - 1) * 100, 3), "fast_ema": round(fast, 5), "slow_ema": round(slow, 5), "trend": trend, "history": [round(x, 5) for x in market.history]})
        return result

    def open_trade(self, symbol: str, side: str, reason: str) -> None:
        if symbol in self.open_positions or len(self.open_positions) >= MAX_OPEN_POSITIONS:
            return
        if self.daily_limit_hit():
            self.running = False
            self.add_event("Daily loss limit reached. Trading automatically halted.", "warning")
            return
        market = self.markets[symbol]
        risk_amount = max(0.0, self.equity) * self.risk.risk_per_trade_pct / 100
        stop_distance = market.price * 0.0025
        if risk_amount <= 0 or stop_distance <= 0:
            return
        units = risk_amount / stop_distance
        direction = 1 if side == "BUY" else -1
        position = {"id": "QFX-" + str(self.tick_count) + "-" + symbol, "symbol": symbol, "side": side, "entry_price": market.price, "units": units, "stop_loss": market.price - direction * stop_distance, "take_profit": market.price + direction * stop_distance * 2, "opened_at": datetime.now(timezone.utc).isoformat(), "strategy": "EMA 9/21 crossover", "reason": reason, "risk_amount": risk_amount}
        self.open_positions[symbol] = position
        self.add_event(side + " " + symbol + " opened in paper mode at " + format(market.price, ".5f") + ".")

    def close_trade(self, symbol: str, price: float, reason: str) -> None:
        position = self.open_positions.pop(symbol, None)
        if not position:
            return
        direction = 1 if position["side"] == "BUY" else -1
        gross = (price - position["entry_price"]) * direction * position["units"]
        costs = position["units"] * position["entry_price"] * 0.00002
        net = gross - costs
        self.balance += net
        self.daily_realised += net
        self.trades.insert(0, {**position, "exit_price": price, "closed_at": datetime.now(timezone.utc).isoformat(), "gross_pnl": gross, "costs": costs, "pnl": net, "exit_reason": reason, "status": "CLOSED"})
        self.add_event(symbol + " closed: " + reason + "; net P/L $" + format(net, ".2f") + ".")
        self.refresh_equity()

    def manage_positions(self) -> None:
        for symbol, position in list(self.open_positions.items()):
            price = self.markets[symbol].price
            if position["side"] == "BUY":
                if price <= position["stop_loss"]:
                    self.close_trade(symbol, price, "Stop loss")
                elif price >= position["take_profit"]:
                    self.close_trade(symbol, price, "Take profit")
            else:
                if price >= position["stop_loss"]:
                    self.close_trade(symbol, price, "Stop loss")
                elif price <= position["take_profit"]:
                    self.close_trade(symbol, price, "Take profit")

    def evaluate_strategy(self) -> None:
        for symbol, market in self.markets.items():
            fast, slow = market.ema(9), market.ema(21)
            crossed_up = market.previous_fast <= market.previous_slow and fast > slow
            crossed_down = market.previous_fast >= market.previous_slow and fast < slow
            market.previous_fast, market.previous_slow = fast, slow
            if crossed_up:
                self.open_trade(symbol, "BUY", "EMA 9 crossed above EMA 21")
            elif crossed_down:
                self.open_trade(symbol, "SELL", "EMA 9 crossed below EMA 21")

    async def run(self) -> None:
        while self.running:
            self.reset_daily_if_needed()
            for market in self.markets.values():
                market.tick()
            self.tick_count += 1
            self.manage_positions()
            self.refresh_equity()
            if self.daily_limit_hit():
                self.running = False
                self.add_event("Daily loss limit reached. Trading automatically halted.", "warning")
                break
            self.evaluate_strategy()
            await asyncio.sleep(TICK_SECONDS)

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.add_event("Autonomous paper trading started. Demo price feed only.")
        self.task = asyncio.create_task(self.run())

    def stop(self) -> None:
        self.running = False
        self.add_event("Paper trading stopped by operator.", "warning")

engine = Engine()

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "quantumfx-api", "version": APP_VERSION}

@app.get("/api/state")
async def state():
    engine.refresh_equity()
    closed = engine.trades
    wins = sum(1 for trade in closed if trade["pnl"] > 0)
    profit = sum(trade["pnl"] for trade in closed if trade["pnl"] > 0)
    loss = abs(sum(trade["pnl"] for trade in closed if trade["pnl"] < 0))
    today = datetime.now(timezone.utc).date().isoformat()
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    return {"app": "QuantumFX AI", "version": APP_VERSION, "mode": engine.mode, "running": engine.running, "feed": "SIMULATED", "feed_label": "Demo prices — not live broker quotes", "started_at": engine.started_at, "capital": round(STARTING_CAPITAL, 2), "balance": round(engine.balance, 2), "equity": round(engine.equity, 2), "available_balance": round(engine.balance, 2), "daily_pnl": round(engine.daily_realised + engine.unrealised_pnl(), 2), "weekly_pnl": round(sum(t["pnl"] for t in closed if t["closed_at"][:10] >= today), 2), "monthly_pnl": round(sum(t["pnl"] for t in closed if t["closed_at"][:7] == month), 2), "open_positions": list(engine.open_positions.values()), "closed_trades": len(closed), "win_rate": round(wins / len(closed) * 100, 1) if closed else 0.0, "profit_factor": round(profit / loss, 2) if loss else None, "risk": engine.risk.model_dump(), "markets": engine.market_snapshot(), "trades": closed[:20], "events": list(engine.events)[:12], "tick_count": engine.tick_count, "daily_limit_hit": engine.daily_limit_hit()}

@app.post("/api/control")
async def control(payload: ControlRequest):
    if payload.action == "start":
        if engine.daily_limit_hit():
            raise HTTPException(status_code=409, detail="Daily loss limit reached. Review risk settings before restarting.")
        engine.start()
    else:
        engine.stop()
    return {"running": engine.running, "mode": engine.mode}

@app.put("/api/risk")
async def update_risk(settings: RiskSettings):
    if engine.running:
        raise HTTPException(status_code=409, detail="Stop paper trading before changing risk settings.")
    engine.risk = settings
    engine.add_event("Risk settings updated: " + str(settings.risk_per_trade_pct) + "% per trade; " + str(settings.daily_loss_limit_pct) + "% daily loss limit.")
    return {"risk": engine.risk.model_dump()}

@app.get("/api/trades")
async def trades():
    return {"open": list(engine.open_positions.values()), "closed": engine.trades[:100]}

@app.on_event("shutdown")
async def shutdown_event():
    engine.stop()
    if engine.task and not engine.task.done():
        engine.task.cancel()
