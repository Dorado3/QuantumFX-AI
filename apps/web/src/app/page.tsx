"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
type Market = { symbol: string; price: number; change_pct: number; fast_ema: number; slow_ema: number; trend: string; history: number[] };
type Trade = { id: string; symbol: string; side: string; entry_price: number; exit_price?: number; stop_loss: number; take_profit: number; pnl?: number; strategy: string; exit_reason?: string };
type State = { running: boolean; mode: string; feed: string; feed_label: string; capital: number; balance: number; equity: number; available_balance: number; daily_pnl: number; weekly_pnl: number; monthly_pnl: number; open_positions: Trade[]; closed_trades: number; win_rate: number; profit_factor: number | null; risk: { risk_per_trade_pct: number; daily_loss_limit_pct: number }; markets: Market[]; trades: Trade[]; events: { time: string; message: string; level: string }[]; tick_count: number; daily_limit_hit: boolean };
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const clock = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const points = useMemo(() => {
    if (values.length < 2) return "";
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    return values.map((v, i) => (i / (values.length - 1) * 100) + "," + (34 - ((v - min) / range) * 30)).join(" ");
  }, [values]);
  return <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="sparkline"><polyline points={points} fill="none" stroke={positive ? "#38d996" : "#ff727c"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}
function Metric({ label, value, detail, positive }: { label: string; value: string; detail?: string; positive?: boolean }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className={"metric-value " + (positive === undefined ? "" : positive ? "positive" : "negative")}>{value}</div>{detail && <div className="metric-detail">{detail}</div>}</div>;
}
export default function Home() {
  const [data, setData] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [apiError, setApiError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("API unavailable");
      setData(await response.json() as State); setApiError("");
    } catch { setApiError("API offline — start the FastAPI service to connect the trading console."); }
  }, []);
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 2500); return () => window.clearInterval(timer); }, [refresh]);
  async function control(action: "start" | "stop") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Unable to change engine state");
      setNotice(action === "start" ? "Paper trading engine started." : "Paper trading engine stopped."); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  if (apiError && !data) return <main className="offline-screen"><div className="brand-mark">Q</div><div className="eyebrow">QUANTUMFX AI / PRIVATE TERMINAL</div><h1>Trading intelligence.<br /><span>Built on discipline.</span></h1><p>{apiError}</p><div className="offline-command">cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000</div><button className="button secondary" onClick={refresh}>Retry connection</button></main>;
  if (!data) return <main className="loading-screen">Initialising QuantumFX AI…</main>;
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">Q</div><div><strong>QUANTUM<span>FX</span></strong><small>INTELLIGENT TRADING</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav><a className="nav-item active" href="#overview"><span>◫</span> Overview</a><a className="nav-item" href="#markets"><span>⌁</span> Market intelligence</a><a className="nav-item" href="#positions"><span>⇄</span> Open positions</a><a className="nav-item" href="#history"><span>▤</span> Trade history</a><a className="nav-item" href="#risk"><span>◈</span> Risk controls</a></nav>
      <div className="sidebar-bottom"><div className="engine-indicator"><i className={data.running ? "live-dot" : "idle-dot"} />{data.running ? "ENGINE RUNNING" : "ENGINE STANDBY"}</div><div className="sidebar-caption">Private single-user build<br />Version 0.1.0 · Paper environment</div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div><div className="eyebrow">COMMAND CENTRE / OVERVIEW</div><h1>Trading dashboard</h1></div><div className="topbar-right"><span className="paper-badge">● PAPER MODE</span><span className="feed-badge">SIMULATED FEED</span><div className="avatar">D3</div></div></header>
      <div className="warning-banner"><span>ⓘ</span><div><strong>Simulation environment only.</strong> Prices are generated for software testing. No live broker quotes or real orders are connected.</div></div>
      {notice && <div className="notice">{notice}</div>}
      <section id="overview" className="metrics-grid"><Metric label="ACCOUNT EQUITY" value={money(data.equity)} detail="Balance + unrealised P/L" /><Metric label="AVAILABLE BALANCE" value={money(data.available_balance)} detail="Paper account funds" /><Metric label="DAILY P/L" value={money(data.daily_pnl)} detail="UTC trading day" positive={data.daily_pnl >= 0} /><Metric label="TOTAL CLOSED TRADES" value={String(data.closed_trades)} detail={data.win_rate.toFixed(1) + "% win rate"} /></section>
      <section className="control-panel"><div className="control-copy"><div className="eyebrow">AUTONOMOUS EXECUTION</div><h2>{data.running ? "QuantumFX is monitoring the market" : "Your trading engine is on standby"}</h2><p>{data.running ? "Analysing " + data.markets.length + " simulated currency pairs · " + data.tick_count + " market cycles completed" : "Start the paper engine to begin automated strategy evaluation and simulated trade management."}</p></div><div className="control-actions"><span className={data.running ? "status-pill running" : "status-pill"}>{data.running ? "● ACTIVE" : "○ STANDBY"}</span>{data.running ? <button className="button stop" onClick={() => control("stop")} disabled={busy}>{busy ? "Please wait…" : "■ Stop engine"}</button> : <button className="button start" onClick={() => control("start")} disabled={busy || data.daily_limit_hit}>{busy ? "Please wait…" : "▶ Start paper trading"}</button>}</div></section>
      <section id="markets" className="section-block"><div className="section-heading"><div><div className="eyebrow">ENGINE 01 / MARKET INTELLIGENCE</div><h2>Market watch</h2></div><span className="muted-tag">EMA 9 / EMA 21</span></div><div className="market-grid">{data.markets.map(m => <article className="market-card" key={m.symbol}><div className="market-top"><strong>{m.symbol.slice(0, 3) + "/" + m.symbol.slice(3)}</strong><span className={m.trend === "BULLISH" ? "trend up" : "trend down"}>{m.trend}</span></div><div className="market-price">{m.price.toFixed(5)}</div><div className={m.change_pct >= 0 ? "market-change positive" : "market-change negative"}>{m.change_pct >= 0 ? "+" : ""}{m.change_pct}% <span>since session start</span></div><Sparkline values={m.history} positive={m.change_pct >= 0} /><div className="ema-row"><span>EMA 9 <b>{m.fast_ema.toFixed(5)}</b></span><span>EMA 21 <b>{m.slow_ema.toFixed(5)}</b></span></div></article>)}</div></section>
      <div className="two-column">
        <section id="positions" className="section-block"><div className="section-heading"><div><div className="eyebrow">ENGINE 04 / EXECUTION</div><h2>Open positions</h2></div><span className="count-badge">{data.open_positions.length}</span></div><div className="table-wrap">{data.open_positions.length === 0 ? <div className="empty-state">No open positions.<br /><span>The strategy will wait for a valid EMA crossover.</span></div> : <table><thead><tr><th>PAIR / SIDE</th><th>ENTRY</th><th>STOP</th><th>TARGET</th></tr></thead><tbody>{data.open_positions.map(p => <tr key={p.id}><td><b>{p.symbol}</b><small className={p.side === "BUY" ? "positive" : "negative"}>{p.side}</small></td><td>{p.entry_price.toFixed(5)}</td><td>{p.stop_loss.toFixed(5)}</td><td>{p.take_profit.toFixed(5)}</td></tr>)}</tbody></table>}</div></section>
        <section id="risk" className="section-block"><div className="section-heading"><div><div className="eyebrow">ENGINE 03 / CAPITAL PROTECTION</div><h2>Risk controls</h2></div><span className="secure-tag">LOCKED RULES</span></div><div className="risk-list"><div><span>Risk per trade</span><strong>{data.risk.risk_per_trade_pct}%</strong></div><div><span>Daily loss limit</span><strong>{data.risk.daily_loss_limit_pct}%</strong></div><div><span>Maximum open positions</span><strong>2</strong></div><div><span>Stop loss required</span><strong className="positive">ENABLED</strong></div><div><span>Strategy override</span><strong className="negative">DISABLED</strong></div></div>{data.daily_limit_hit && <div className="risk-alert">Daily loss limit reached. New trades are blocked.</div>}</section>
      </div>
      <section id="history" className="section-block"><div className="section-heading"><div><div className="eyebrow">ENGINE 05 / PERFORMANCE</div><h2>Recent trade history</h2></div><span className="muted-tag">LATEST 20</span></div><div className="table-wrap">{data.trades.length === 0 ? <div className="empty-state">No completed trades yet.<br /><span>Every simulated position will be recorded here when closed.</span></div> : <table><thead><tr><th>INSTRUMENT</th><th>DIRECTION</th><th>ENTRY</th><th>EXIT</th><th>NET P/L</th><th>EXIT REASON</th></tr></thead><tbody>{data.trades.map(t => <tr key={t.id}><td><b>{t.symbol}</b></td><td>{t.side}</td><td>{t.entry_price.toFixed(5)}</td><td>{t.exit_price?.toFixed(5)}</td><td className={(t.pnl ?? 0) >= 0 ? "positive" : "negative"}>{money(t.pnl ?? 0)}</td><td>{t.exit_reason}</td></tr>)}</tbody></table>}</div></section>
      <section className="section-block"><div className="section-heading"><div><div className="eyebrow">SYSTEM / AUDIT TRAIL</div><h2>Engine activity</h2></div><span className="muted-tag">LATEST EVENTS</span></div><div className="activity-list">{data.events.map((e, i) => <div className="activity-row" key={e.time + i}><span className={e.level === "warning" ? "event-dot warning" : "event-dot"} /><time>{clock(e.time)}</time><p>{e.message}</p></div>)}</div></section>
      <footer>QUANTUMFX AI <span>INTELLIGENCE IN EVERY DECISION. DISCIPLINE IN EVERY TRADE.</span><span>SIMULATION ONLY · NOT FINANCIAL ADVICE</span></footer>
    </section>
  </main>;
}
