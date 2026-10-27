"use client";

import { useEffect, useMemo, useState } from "react";

const nav = [
  ["dashboard", "⌂", "Dashboard"],
  ["auto", "↗", "Auto Trade"],
  ["scanner", "⌕", "Scanner"],
  ["broker", "⌘", "Broker"],
  ["settings", "⚙", "Settings"],
  ["news", "◉", "News"],
];

const plans = [
  { name: "Weekly", price: "100", duration: "7 days" },
  { name: "Monthly", price: "400", duration: "30 days", popular: true },
  { name: "Yearly", price: "1,000", duration: "365 days" },
];

export default function Home() {
  const [page, setPage] = useState("landing");
  const [tab, setTab] = useState("dashboard");
  const [accessKey, setAccessKey] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Monthly");
  const [accountMode, setAccountMode] = useState("demo");
  const [maxTrades, setMaxTrades] = useState(2);
  const [lotSize, setLotSize] = useState("0.01");
  const [symbol, setSymbol] = useState("EURUSD");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState("gold");
  const [brokerStatus, setBrokerStatus] = useState("Not connected");
  const [scannerResult, setScannerResult] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerTimeframe, setScannerTimeframe] = useState("15m");
  const [scannerRefresh, setScannerRefresh] = useState(0);
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [newsItems, setNewsItems] = useState([
    { title: "Welcome to NexusFX", body: "Admin announcements will appear here once the news service is configured.", date: "Platform notice" },
  ]);

  const accent = theme === "gold" ? "#e7c66d" : theme === "blue" ? "#75baff" : "#80d6a1";
  const titleMode = accountMode === "demo" ? "DEMO" : "REAL";
  const enterApp = () => {
    if (!accessKey.trim()) {
      setMessage("Enter an access key to continue. Subscription verification will be connected before paid access is enabled.");
      return;
    }
    setMessage("Access keys are not yet connected to a secure verification service. Login is disabled until backend authentication is configured.");
  };

  const activateAuto = () => {
    if (accountMode === "real") {
      setMessage("Real trading is locked until MetaApi connectivity, authenticated access, and risk checks have been verified.");
      return;
    }
    setAutoEnabled(false);
    setMessage("Auto Trade is not armed: connect a MetaApi MT5 account and complete strategy/risk validation first. No orders were placed.");
  };


  useEffect(() => {
    if (tab !== "scanner") return;
    let cancelled = false;
    let timer;
    const loadAnalysis = async () => {
      setScannerLoading(true);
      try {
        const response = await fetch(`/api/scanner?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(scannerTimeframe)}`, { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) setScannerResult({ ...data, httpOk: response.ok });
      } catch {
        if (!cancelled) setScannerResult({ connected: false, signal: "WAIT", error: "Unable to reach the scanner API." });
      } finally {
        if (!cancelled) {
          setScannerLoading(false);
          timer = setTimeout(loadAnalysis, 60000);
        }
      }
    };
    loadAnalysis();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, symbol, scannerTimeframe, scannerRefresh]);

  const tabContent = useMemo(() => {
    if (tab === "dashboard") return (
      <div className="panel-grid">
        <section className="panel hero-panel">
          <div className="eyebrow">ACCOUNT OVERVIEW · {titleMode}</div>
          <h2>Your trading workspace</h2>
          <p className="muted">Connect your MT5 account through MetaApi to load verified account information.</p>
          <div className="account-empty"><span className="pulse-dot" /> Waiting for broker account data</div>
          <div className="stats-grid">
            <Metric label="Balance" value="—" note="Awaiting broker data" />
            <Metric label="Equity" value="—" note="Awaiting broker data" />
            <Metric label="Open positions" value="—" note="Not connected" />
            <Metric label="Floating P/L" value="—" note="Not connected" />
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Account mode</h3><span className={accountMode === "demo" ? "tag" : "tag danger"}>{titleMode}</span></div>
          <p className="muted">Choose the account mode you intend to use. This selector does not change your broker account.</p>
          <div className="segmented">
            <button className={accountMode === "demo" ? "selected" : ""} onClick={() => {setAccountMode("demo"); setMessage("");}}>Demo</button>
            <button className={accountMode === "real" ? "selected" : ""} onClick={() => {setAccountMode("real"); setMessage("");}}>Real</button>
          </div>
          <button className="primary full" onClick={() => setTab("broker")}>Connect MT5 account <span>↗</span></button>
        </section>
      </div>
    );
    if (tab === "auto") return (
      <div className="two-col">
        <section className="panel">
          <div className="eyebrow">AUTOMATION CONTROLS</div><h2>Auto Trade</h2>
          <p className="muted">Configure the trading limits. The engine stays off until a verified broker connection, tested strategy, and risk controls are available.</p>
          <label className="field-label">Trading account</label>
          <div className="segmented"><button className={accountMode === "demo" ? "selected" : ""} onClick={() => setAccountMode("demo")}>Demo</button><button className={accountMode === "real" ? "selected" : ""} onClick={() => setAccountMode("real")}>Real</button></div>
          <label className="field-label" htmlFor="symbol">Forex pair</label>
          <select id="symbol" value={symbol} onChange={e => setSymbol(e.target.value)}><option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option><option>USDCHF</option><option>AUDUSD</option><option>USDCAD</option><option>NZDUSD</option><option>XAUUSD</option></select>
          <label className="field-label" htmlFor="maxTrades">Maximum simultaneous open trades <strong>{maxTrades}</strong></label>
          <input id="maxTrades" type="range" min="1" max="10" value={maxTrades} onChange={e => setMaxTrades(Number(e.target.value))} />
          <label className="field-label" htmlFor="lotSize">Lot size per trade</label>
          <select id="lotSize" value={lotSize} onChange={e => setLotSize(e.target.value)}><option value="0.01">0.01</option><option value="0.02">0.02</option><option value="0.05">0.05</option><option value="0.10">0.10</option><option value="0.20">0.20</option><option value="0.50">0.50</option><option value="1.00">1.00</option></select>
          <div className="risk-note"><strong>Safety lock active</strong><span>Settings are saved only in this session. No order will be placed.</span></div>
          <button className="primary full" onClick={activateAuto}>Enable Auto Trade <span>→</span></button>
          {message && <p className="inline-message">{message}</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Engine status</h3><span className="tag warning">Not armed</span></div>
          <div className="engine-visual"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="robot-face">N<span>FX</span></div></div>
          <h3 className="center">Waiting for verified connection</h3>
          <p className="muted center">Live market analysis and execution will be enabled after the backend and risk checks are implemented.</p>
          <div className="check-row"><span>01</span> MetaApi MT5 connection <b>Pending</b></div>
          <div className="check-row"><span>02</span> Strategy validation <b>Pending</b></div>
          <div className="check-row"><span>03</span> Risk limits <b>Pending</b></div>
        </section>
      </div>
    );
    if (tab === "scanner") return (
      <section className="panel">
        <div className="eyebrow">LIVE MARKET ANALYSIS</div>
        <div className="panel-head"><h2>Scanner</h2><span className={scannerResult?.connected ? "tag" : "tag warning"}>{scannerResult?.connected ? "METAAPI CONNECTED" : "DATA PENDING"}</span></div>
        <p className="muted">Signals are calculated from MT5 candles through MetaApi. This scanner provides technical setups, not guaranteed outcomes or automatic orders.</p>
        <div className="scanner-controls">
          <div><label className="field-label" htmlFor="scannerSymbol">Symbol</label><select id="scannerSymbol" value={symbol} onChange={e => setSymbol(e.target.value)}><option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option><option>USDCHF</option><option>AUDUSD</option><option>USDCAD</option><option>NZDUSD</option><option>XAUUSD</option></select></div>
          <div><label className="field-label" htmlFor="scannerTimeframe">Timeframe</label><select id="scannerTimeframe" value={scannerTimeframe} onChange={e => setScannerTimeframe(e.target.value)}><option value="5m">M5</option><option value="15m">M15</option><option value="30m">M30</option><option value="1h">H1</option><option value="4h">H4</option></select></div>
          <button className="outline scan-refresh" onClick={() => {setScannerResult(null);setScannerRefresh(value => value + 1);}}>Refresh analysis</button>
          <button className="outline scan-refresh" disabled={backtestLoading} onClick={async () => {setBacktestLoading(true);setBacktestResult(null);try {const response = await fetch(`/api/scanner/backtest?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(scannerTimeframe)}`, {cache:"no-store"});const data = await response.json();setBacktestResult({...data,httpOk:response.ok});} catch {setBacktestResult({error:"Unable to reach the backtest API."});} finally {setBacktestLoading(false);}}}>{backtestLoading ? "Testing…" : "Run backtest"}</button>
        </div>
        {scannerLoading && <p className="muted">Requesting latest candles and recalculating indicators…</p>}
        {scannerResult?.error && <p className="inline-message">{scannerResult.error} {scannerResult.detail || ""}</p>}
        <div className="signal-summary">
          <div><span className="eyebrow">CURRENT SETUP</span><strong className={scannerResult?.signal === "BUY" ? "signal-buy" : scannerResult?.signal === "SELL" ? "signal-sell" : "signal-wait"}>{scannerResult?.signal || "WAIT"}</strong><small>{scannerResult?.setupScore ?? 0}% condition agreement · not win probability</small></div>
          <div><span className="eyebrow">CANDLES ANALYZED</span><strong>{scannerResult?.candleCount ?? "—"}</strong><small>{scannerResult?.timeframe || scannerTimeframe} · {scannerResult?.symbol || symbol}</small></div>
        </div>
        <p className="scanner-reason">{scannerResult?.reason || "Waiting for live market data. Configure MetaApi on the server to analyze real MT5 candles."}</p>
        <div className="stats-grid scanner-indicators">
          <Metric label="EMA 20" value={scannerResult?.indicators?.ema20 ?? "—"} note="Short trend" />
          <Metric label="EMA 50" value={scannerResult?.indicators?.ema50 ?? "—"} note="Longer trend" />
          <Metric label="RSI 14" value={scannerResult?.indicators?.rsi14 ?? "—"} note="Momentum" />
          <Metric label="ATR 14" value={scannerResult?.indicators?.atr14 ?? "—"} note="Volatility" />
        </div>
        {scannerResult?.levels && <div className="stats-grid scanner-indicators"><Metric label="Entry reference" value={scannerResult.levels.entry} note="Last analyzed candle close" /><Metric label="Stop loss reference" value={scannerResult.levels.stopLoss} note="1.5 × ATR" /><Metric label="Take profit reference" value={scannerResult.levels.takeProfit} note="2 × ATR" /><Metric label="Risk / reward" value={scannerResult.levels.riskReward} note="Before spread and costs" /></div>}
        <div className="backtest-panel">
          <div className="panel-head"><h3>Historical strategy test</h3><span className="tag">OHLC SIMULATION</span></div>
          <p className="muted">Tests the same EMA/RSI/ATR rules against available historical candles. It does not place orders.</p>
          {backtestResult?.error && <p className="inline-message">{backtestResult.error} {backtestResult.detail || ""}</p>}
          {backtestResult?.status === "insufficient_data" && <p className="muted">Not enough closed candles for a useful backtest yet ({backtestResult.candleCount || 0} available).</p>}
          {backtestResult?.status === "complete" && <><div className="stats-grid scanner-indicators"><Metric label="Trades" value={backtestResult.trades} note="Closed historical simulations" /><Metric label="Win rate" value={backtestResult.winRate == null ? "—" : backtestResult.winRate + "%"} note="Historical sample only" /><Metric label="Profit factor" value={backtestResult.profitFactor ?? "—"} note="Before trading costs" /><Metric label="Net result" value={(backtestResult.netR > 0 ? "+" : "") + backtestResult.netR + "R"} note="Risk-unit return" /><Metric label="Expectancy" value={backtestResult.expectancyR == null ? "—" : backtestResult.expectancyR + "R"} note="Average per trade" /><Metric label="Max drawdown" value={backtestResult.maxDrawdownR + "R"} note="In risk units" /></div><p className="fine-print">{(backtestResult.assumptions || []).join(" ")}</p></>}
        </div>
        <p className="fine-print">Technical analysis can fail. Levels are reference estimates, not a broker-validated order. No trade is executed by the scanner.</p>
      </section>
    );
    if (tab === "broker") return (
      <div className="two-col">
        <section className="panel"><div className="eyebrow">BROKER CONNECTION</div><h2>Connect MetaTrader 5</h2><p className="muted">NexusFX uses MetaApi to connect to MT5. No MT5 terminal needs to run on Vercel. Your MetaApi token must be stored as a server environment variable.</p>
          <div className="broker-card"><div className="broker-mark">MT5</div><div><strong>MetaApi · MetaTrader 5</strong><p className="muted small">Server-side connection</p></div><span className="tag warning">{brokerStatus}</span></div>
          <label className="field-label">Account mode</label><div className="segmented"><button className={accountMode === "demo" ? "selected" : ""} onClick={() => setAccountMode("demo")}>Demo</button><button className={accountMode === "real" ? "selected" : ""} onClick={() => setAccountMode("real")}>Real</button></div>
          <p className="muted small">Account connection is not enabled until the MetaApi account ID and token are configured securely on the server.</p>
          <button className="primary full" onClick={() => {setBrokerStatus("Setup required"); setMessage("Add METAAPI_TOKEN and METAAPI_ACCOUNT_ID in Vercel Environment Variables, then deploy. This UI has not verified a broker connection.");}}>Check connection setup</button>
          {message && <p className="inline-message">{message}</p>}
        </section>
        <section className="panel"><h3>Connection checklist</h3>{["Create a MetaApi account","Deploy/authorize the MT5 account in MetaApi","Set server-side environment variables in Vercel","Verify account mode and account information","Test order execution on demo first"].map((x,i)=><div className="check-row" key={x}><span>{String(i+1).padStart(2,"0")}</span>{x}<b>Pending</b></div>)}</section>
      </div>
    );
    if (tab === "settings") return <section className="panel"><div className="eyebrow">PERSONALIZE WORKSPACE</div><h2>Settings</h2><p className="muted">Choose your accent colour.</p><div className="theme-options">{[["gold","#e7c66d","Gold"],["blue","#75baff","Blue"],["mint","#80d6a1","Mint"]].map(([id,color,label])=><button key={id} className={theme===id?"theme-choice active":"theme-choice"} onClick={()=>setTheme(id)}><span style={{background:color}}></span>{label}</button>)}</div><div className="risk-note"><strong>Security</strong><span>Authentication, subscription management and API secrets will be managed server-side; never paste a MetaApi token into this page.</span></div></section>;
    if (tab === "news") return <section className="panel"><div className="eyebrow">ADMIN ANNOUNCEMENTS</div><h2>News & Updates</h2><p className="muted">Updates published by the NexusFX administrator will appear here.</p>{newsItems.map((n,i)=><article className="news-card" key={i}><span className="eyebrow">{n.date}</span><h3>{n.title}</h3><p>{n.body}</p></article>)}</section>;
    return null;
  }, [tab, accountMode, maxTrades, lotSize, symbol, message, brokerStatus, theme, titleMode, newsItems, scannerResult, scannerLoading, scannerTimeframe, scannerRefresh, backtestResult, backtestLoading]);

  if (page === "landing") return (
    <main className="landing" style={{"--accent":accent}}>
      <header className="topbar landing-top"><a className="brand" href="#"><span className="brand-icon">N</span><span>NEXUS<span className="brand-fx">FX</span><small>FOREX TRADING OS</small></span></a><button className="quiet-button" onClick={() => {setPage("login");setMessage("");}}>Sign in ↗</button></header>
      <section className="landing-grid">
        <div className="landing-copy"><div className="eyebrow"><span className="status-dot"></span> AUTOMATED FOREX WORKSPACE</div><h1>Trade with a<br/><span>clearer edge.</span></h1><p className="landing-sub">A focused trading workspace for market scanning, strategy-driven automation, and your connected MT5 account.</p>
          <div className="hero-points"><span>↗ Market scanner</span><span>⌘ MT5 via MetaApi</span><span>◈ Risk controls</span></div>
          <div className="robot-stage"><div className="robot-halo"></div><div className="robot-illustration"><div className="robot-ear left"></div><div className="robot-ear right"></div><div className="robot-head"><div className="robot-antenna"></div><div className="robot-eye"></div><div className="robot-eye"></div><div className="robot-mouth"></div></div><div className="robot-neck"></div><div className="robot-body"><span>N</span><small>NEXUSFX</small></div><div className="robot-arm arm-left"></div><div className="robot-arm arm-right"></div></div><div className="robot-caption"><span className="pulse-dot"></span> STRATEGY ENGINE <b>READY FOR SETUP</b></div></div>
        </div>
        <div className="plans-column"><div className="plan-heading"><span className="eyebrow">MEMBERSHIP</span><h2>Choose your access</h2><p>Unlock your workspace with a plan or access key.</p></div>
          <div className="plans">{plans.map(plan=><button key={plan.name} className={selectedPlan===plan.name?"plan-card chosen":"plan-card"} onClick={()=>setSelectedPlan(plan.name)}><span className="plan-top"><span>{plan.name}</span>{plan.popular&&<em>POPULAR</em>}</span><span className="plan-price">{plan.price}<small> / {plan.duration}</small></span><span className="plan-foot">{selectedPlan===plan.name?"Selected plan":"Choose plan"} <b>→</b></span></button>)}</div>
          <div className="currency-note">Currency and checkout are not enabled yet. Prices are provisional.</div>
          <button className="primary full large-button" onClick={()=>{setPage("login");setMessage("Selected "+selectedPlan+" plan. Payment activation requires confirmed currency and verified checkout.");}}>Continue with {selectedPlan} <span>→</span></button>
          <div className="key-divider"><span></span> OR USE ACCESS KEY <span></span></div>
          <button className="outline full" onClick={()=>{setPage("login");setMessage("");}}> <span>♢</span> Enter access key</button>
          <p className="fine-print">Subscription and access-key verification will be handled securely by the server. No payment has been taken.</p>
        </div>
      </section>
      <footer className="landing-footer"><span>© 2026 NEXUSFX</span><span>MT5 CONNECTIVITY VIA METAAPI</span><span>TRADING INVOLVES RISK</span></footer>
    </main>
  );

  if (page === "login") return <main className="login-page" style={{"--accent":accent}}><button className="back-button" onClick={()=>{setPage("landing");setMessage("");}}>← Back to landing</button><div className="login-card"><div className="brand centered-brand"><span className="brand-icon">N</span><span>NEXUS<span className="brand-fx">FX</span><small>FOREX TRADING OS</small></span></div><h1>Welcome back</h1><p className="muted">Enter your access key to continue.</p><label className="field-label" htmlFor="accessKey">Access key</label><input id="accessKey" placeholder="NEXUS-XXXX-XXXX" value={accessKey} onChange={e=>setAccessKey(e.target.value)} autoComplete="off"/><button className="primary full large-button" onClick={enterApp}>Verify access key <span>→</span></button>{message&&<p className="inline-message">{message}</p>}<p className="fine-print">Authentication is not active yet. A backend license service is required before access can be granted.</p></div></main>;

  return <main className="app-shell" style={{"--accent":accent}}><aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage("landing");}}><span className="brand-icon">N</span><span>NEXUS<span className="brand-fx">FX</span><small>FOREX TRADING OS</small></span></a><div className="side-label">WORKSPACE</div><nav>{nav.map(([id,icon,label])=><button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>{setTab(id);setMessage("");}}><span className="nav-icon">{icon}</span>{label}{tab===id&&<span className="nav-active"></span>}</button>)}</nav><div className="sidebar-bottom"><div className="connection-mini"><span className="status-dot"></span><div><strong>MetaApi</strong><small>Setup required</small></div></div><button className="quiet-button" onClick={()=>setPage("landing")}>Sign out</button></div></aside><section className="main-area"><header className="app-topbar"><div><div className="eyebrow">NEXUSFX / WORKSPACE</div><h1>{nav.find(n=>n[0]===tab)?.[2]}</h1></div><div className="top-actions"><span className={accountMode==="demo"?"tag":"tag danger"}>{titleMode} ACCOUNT</span><div className="avatar">N</div></div></header><div className="content-area">{tabContent}</div><footer className="app-footer"><span>Broker data: not connected</span><span>Auto execution: locked</span></footer></section></main>;
}

function Metric({label,value,note}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
