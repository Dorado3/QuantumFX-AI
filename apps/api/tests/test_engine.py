from app.main import Engine, RiskSettings


def test_engine_starts_stopped_in_paper_mode():
    engine = Engine()
    assert engine.balance == 1000.0
    assert engine.mode == "PAPER"
    assert engine.running is False
    assert engine.open_positions == {}


def test_position_size_uses_configured_risk():
    engine = Engine()
    engine.risk = RiskSettings(risk_per_trade_pct=0.5, daily_loss_limit_pct=2.0)
    engine.open_trade("EURUSD", "BUY", "unit test signal")
    position = engine.open_positions["EURUSD"]
    assert round(position["risk_amount"], 2) == 5.00
    assert position["stop_loss"] < position["entry_price"]
    assert position["take_profit"] > position["entry_price"]


def test_daily_loss_limit_blocks_new_positions():
    engine = Engine()
    engine.daily_realised = -20.01
    assert engine.daily_limit_hit() is True
    engine.open_trade("EURUSD", "BUY", "blocked by circuit breaker")
    assert engine.open_positions == {}
