"use client";

import { useEffect, useState } from "react";

const plans = [{id:"weekly",label:"Weekly",price:"$100"},{id:"monthly",label:"Monthly",price:"$400"},{id:"yearly",label:"Yearly",price:"$1,000"}];
const inputStyle = { width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #41434a",borderRadius:7,background:"#090a0c",color:"#fff",marginTop:6 };
const buttonStyle = { width:"100%",padding:12,border:0,borderRadius:7,background:"#e7c66d",color:"#111",fontWeight:750,cursor:"pointer",marginTop:12 };
const panelStyle = { background:"#111317",border:"1px solid #303238",borderRadius:12,padding:18,marginBottom:14 };

export default function Portal() {
  const [mode,setMode]=useState("register");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [user,setUser]=useState(null);
  const [subscription,setSubscription]=useState(null);
  const [broker,setBroker]=useState(null);
  const [server,setServer]=useState("");
  const [accountMode,setAccountMode]=useState("real");
  const [confirmReal,setConfirmReal]=useState(false);
  const [settings,setSettings]=useState({symbol:"EURUSD",timeframe:"15m",lotSize:"0.01",maxOpenTrades:1,maxDailyLossPercent:1,autoEnabled:false,liveTradingEnabled:false});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [configUrl,setConfigUrl]=useState("");
  const [acceptRisk,setAcceptRisk]=useState(false);

  async function api(path, options={}) {
    const response=await fetch(path,{...options,cache:"no-store",headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({error:"Invalid server response"}));
    if(!response.ok) throw new Error(data.error||"Request failed");
    return data;
  }
  async function refresh() {
    try {
      const me=await api("/api/auth/me");
      setUser(me.user);
      try { const sub=await api("/api/subscriptions/status");setSubscription(sub.active); } catch { setSubscription(null); }
      try { const b=await api("/api/broker/status");setBroker(b); } catch { setBroker(null); }
      try { const s=await api("/api/trading/settings");if(s.settings)setSettings({...s.settings,lotSize:String(s.settings.lot_size),maxOpenTrades:s.settings.max_open_trades,maxDailyLossPercent:Number(s.settings.max_daily_loss_percent),autoEnabled:s.settings.auto_enabled,liveTradingEnabled:s.settings.live_trading_enabled}); } catch {}
    } catch { setUser(null); }
  }
  useEffect(()=>{refresh();},[]);

  async function auth(event) {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      await api(mode==="register"?"/api/auth/register":"/api/auth/login",{method:"POST",body:JSON.stringify({email,password})});
      setPassword("");await refresh();setMessage("Signed in. Select a USD subscription to unlock broker features.");
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function checkout(plan) {
    setBusy(true);setMessage("");
    try { const data=await api("/api/subscriptions/checkout",{method:"POST",body:JSON.stringify({plan})});window.location.assign(data.checkoutUrl); }
    catch(e){setMessage(e.message);setBusy(false);}
  }
  async function connectBroker(event) {
    event.preventDefault();setBusy(true);setMessage("");setConfigUrl("");
    try {
      const data=await api("/api/broker/connect",{method:"POST",body:JSON.stringify({server,mode:accountMode,confirmRealTrading:confirmReal})});
      setConfigUrl(data.configurationUrl||"");setMessage(data.message||"Complete broker configuration in MetaApi.");await refresh();
    } catch(e){setMessage(e.message);} finally {setBusy(false);}
  }
  async function saveSettings(event) {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      const data=await api("/api/trading/settings",{method:"POST",body:JSON.stringify({...settings,lotSize:Number(settings.lotSize),maxOpenTrades:Number(settings.maxOpenTrades),maxDailyLossPercent:Number(settings.maxDailyLossPercent),confirmRealTrading:acceptRisk})});
      setSettings({...data.settings,lotSize:String(data.settings.lot_size),maxOpenTrades:data.settings.max_open_trades,maxDailyLossPercent:Number(data.settings.max_daily_loss_percent),autoEnabled:data.settings.auto_enabled,liveTradingEnabled:data.settings.live_trading_enabled});
      setMessage(data.message);
    } catch(e){setMessage(e.message);} finally {setBusy(false);}
  }
  async function stopTrading() {
    setBusy(true);
    try { await api("/api/trading/stop",{method:"POST"});setSettings({...settings,autoEnabled:false,liveTradingEnabled:false});setMessage("Auto-trading disabled. Existing open positions were not closed."); }
    catch(e){setMessage(e.message);} finally {setBusy(false);}
  }
  async function logout() {
    try { await api("/api/auth/logout",{method:"POST"});setUser(null);setSubscription(null);setBroker(null);setMessage("Signed out.");}
    catch(e){setMessage(e.message);}
  }

  return <main style={{minHeight:"100vh",background:"#08090b",color:"#f3f1e9",fontFamily:"system-ui,sans-serif",padding:"18px 14px"}}>
    <header style={{maxWidth:880,margin:"8px auto 24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <a href="/" style={{color:"#f3f1e9",textDecoration:"none",fontWeight:800,letterSpacing:2}}>NEXUS<span style={{color:"#e7c66d"}}>FX</span></a>
      {user?<button onClick={logout} style={{background:"transparent",color:"#e7c66d",border:"1px solid #454545",padding:"9px 12px",borderRadius:6}}>Sign out</button>:<span style={{color:"#a3a7af",fontSize:12}}>Subscriber portal</span>}
    </header>
    <div style={{maxWidth:880,margin:"0 auto"}}>
      {!user ? <section style={panelStyle}>
        <h1 style={{fontSize:26,margin:"0 0 6px"}}>{mode==="register"?"Create your NexusFX account":"Sign in to NexusFX"}</h1>
        <p style={{color:"#a3a7af",fontSize:13,lineHeight:1.6}}>Subscriber access is tied to your account. Do not share broker credentials with anyone.</p>
        <form onSubmit={auth}>
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" style={inputStyle}/></label>
          <label style={{display:"block",marginTop:12}}>Password (12+ characters)<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==="register"?12:1} maxLength={128} required autoComplete={mode==="register"?"new-password":"current-password"} style={inputStyle}/></label>
          <button disabled={busy} style={buttonStyle}>{busy?"Please wait":mode==="register"?"Create account":"Sign in"}</button>
        </form>
        <button onClick={()=>setMode(mode==="register"?"login":"register")} style={{marginTop:12,background:"transparent",border:0,color:"#e7c66d"}}>{mode==="register"?"Already registered? Sign in":"New here? Create account"}</button>
      </section> : <>
        <section style={panelStyle}>
          <h1 style={{fontSize:24,margin:"0 0 4px"}}>Subscriber workspace</h1>
          <p style={{color:"#a3a7af",fontSize:13}}>Signed in as {user.email}</p>
          <p style={{fontSize:13}}>Subscription: {subscription? <strong style={{color:"#80d6a1"}}>{subscription.plan} · USD · expires {new Date(subscription.expires_at).toLocaleDateString()}</strong> : <strong style={{color:"#e7c66d"}}>No active subscription</strong>}</p>
          {!subscription && <><p style={{color:"#a3a7af",fontSize:13}}>Pay for a plan to unlock broker linking, scanning and trading controls. Access activates only after the signed payment webhook is verified.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{plans.map(p=><button key={p.id} disabled={busy} onClick={()=>checkout(p.id)} style={{...buttonStyle,marginTop:0}}>{p.label} · {p.price}</button>)}</div></>}
        </section>
        {subscription && <>
          <section style={panelStyle}>
            <h2 style={{fontSize:19,marginTop:0}}>Connect your own MT5 account</h2>
            <p style={{color:"#a3a7af",fontSize:13,lineHeight:1.6}}>NexusFX creates an isolated MetaApi account and returns a MetaApi-hosted configuration link. Enter your MT5 credentials only on the MetaApi page; NexusFX does not save your broker password.</p>
            <form onSubmit={connectBroker}>
              <label>Exact MT5 server name<input value={server} onChange={e=>setServer(e.target.value)} required maxLength={120} placeholder="e.g. BrokerName-Live" style={inputStyle}/></label>
              <label style={{display:"block",marginTop:12}}>Account type<select value={accountMode} onChange={e=>setAccountMode(e.target.value)} style={inputStyle}><option value="real">Real account</option><option value="demo">Demo account</option></select></label>
              {accountMode==="real"&&<label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:12,color:"#e7c66d",marginTop:12}}><input type="checkbox" checked={confirmReal} onChange={e=>setConfirmReal(e.target.checked)}/> I confirm this is my own real MT5 account and I authorize NexusFX to request live trading access once enabled.</label>}
              <button disabled={busy} style={buttonStyle}>{busy?"Requesting…":"Create secure MetaApi configuration link"}</button>
            </form>
            {configUrl&&<p style={{marginTop:14}}><a href={configUrl} target="_blank" rel="noreferrer" style={{color:"#e7c66d",overflowWrap:"anywhere"}}>Open MetaApi secure account configuration ↗</a></p>}
            {broker?.account&&<p style={{fontSize:13,color:broker.connected?"#80d6a1":"#e7c66d"}}>Broker: {broker.account.server} · {broker.account.mode.toUpperCase()} · {broker.account.connectionStatus}</p>}
            <button onClick={()=>refresh()} style={{...buttonStyle,background:"transparent",color:"#e7c66d",border:"1px solid #555"}}>Refresh broker status</button>
            {broker?.summary&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:14}}>{[["Balance",broker.summary.balance+" "+broker.summary.currency],["Equity",broker.summary.equity+" "+broker.summary.currency],["Open positions",broker.summary.openPositions]].map(([k,v])=><div key={k} style={{background:"#090a0c",padding:12,borderRadius:8}}><small style={{color:"#a3a7af"}}>{k}</small><div style={{fontWeight:700,marginTop:5}}>{v}</div></div>)}</div>}
          </section>
          <section style={panelStyle}>
            <h2 style={{fontSize:19,marginTop:0}}>Auto-trading controls</h2>
            <p style={{color:"#a3a7af",fontSize:13,lineHeight:1.6}}>The live engine runs on a scheduled Vercel cron and stays off unless both server-level live trading and your explicit account-level consent are enabled. Fixed lots are capped at 0.10; maximum open positions are capped at 3.</p>
            <form onSubmit={saveSettings}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
                <label>Symbol<select value={settings.symbol} onChange={e=>setSettings({...settings,symbol:e.target.value})} style={inputStyle}>{["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","XAUUSD"].map(s=><option key={s}>{s}</option>)}</select></label>
                <label>Timeframe<select value={settings.timeframe} onChange={e=>setSettings({...settings,timeframe:e.target.value})} style={inputStyle}>{["5m","15m","30m","1h","4h"].map(s=><option key={s}>{s}</option>)}</select></label>
                <label>Lot size<input type="number" min="0.01" max="0.10" step="0.01" value={settings.lotSize} onChange={e=>setSettings({...settings,lotSize:e.target.value})} required style={inputStyle}/></label>
                <label>Maximum open trades<select value={settings.maxOpenTrades} onChange={e=>setSettings({...settings,maxOpenTrades:Number(e.target.value)})} style={inputStyle}>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                <label>Daily loss limit (%)<select value={settings.maxDailyLossPercent} onChange={e=>setSettings({...settings,maxDailyLossPercent:Number(e.target.value)})} style={inputStyle}>{[0.5,1,1.5,2].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>
              </div>
              <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:12,color:"#e7c66d",marginTop:16}}><input type="checkbox" checked={settings.autoEnabled} onChange={e=>setSettings({...settings,autoEnabled:e.target.checked})}/> Enable scheduled auto-trading for my linked account.</label>
              <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:12,color:"#e7c66d",marginTop:12}}><input type="checkbox" checked={settings.liveTradingEnabled} onChange={e=>setSettings({...settings,liveTradingEnabled:e.target.checked})}/> I explicitly authorize live-money orders on my real account when the platform operator has enabled live execution.</label>
              <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:12,color:"#a3a7af",marginTop:12}}><input type="checkbox" checked={acceptRisk} onChange={e=>setAcceptRisk(e.target.checked)}/> I understand automated trading can lose money and I accept the configured limits.</label>
              <button disabled={busy} style={buttonStyle}>{busy?"Saving…":"Save trading settings"}</button>
            </form>
            <button disabled={busy} onClick={stopTrading} style={{...buttonStyle,background:"#331d1d",color:"#ffb3ad",marginTop:8}}>Emergency stop auto-trading</button>
            <p style={{color:"#a3a7af",fontSize:11,lineHeight:1.6,marginBottom:0}}>Emergency stop disables new automatic entries but does not close positions already open at the broker. Confirm actual order status in MT5. Strategy levels are not guaranteed risk amounts; lot size and stop distance can still result in slippage or gaps.</p>
          </section>
        </>}
      </>}
      {message&&<p role="status" style={{padding:12,border:"1px solid #4c452d",borderRadius:8,color:"#e7c66d",fontSize:13,overflowWrap:"anywhere"}}>{message}</p>}
      <p style={{color:"#737781",fontSize:11,lineHeight:1.6}}>Live trading remains disabled until server environment, database, MetaApi provisioning, subscription webhook and operational checks are verified. Never share your MetaApi token or broker password.</p>
    </div>
  </main>;
}
