"use client";

import { useEffect, useState } from "react";

export default function SubscriptionVerify() {
  const [status,setStatus]=useState("Checking subscription status…");
  const [active,setActive]=useState(false);
  const [busy,setBusy]=useState(false);

  async function check() {
    setBusy(true);
    try {
      const response=await fetch("/api/subscriptions/status",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Sign in again to verify the subscription.");
      if(data.active) {
        setActive(true);
        setStatus(`Payment verified. Your ${data.active.plan} subscription is active until ${new Date(data.active.expires_at).toLocaleString()}.`);
      } else {
        setActive(false);
        setStatus("Payment return received, but no active subscription is recorded yet. The payment provider webhook must verify the transaction first. Wait a moment and refresh this status.");
      }
    } catch(error) { setActive(false);setStatus(error.message||"Unable to verify subscription."); }
    finally { setBusy(false); }
  }
  useEffect(()=>{check();},[]);
  return <main style={{minHeight:"100vh",background:"#08090b",color:"#f3f1e9",fontFamily:"system-ui,sans-serif",display:"grid",placeItems:"center",padding:18}}>
    <section style={{maxWidth:560,width:"100%",background:"#111317",border:"1px solid #343434",borderRadius:12,padding:24}}>
      <a href="/" style={{color:"#e7c66d",textDecoration:"none",fontWeight:800,letterSpacing:2}}>NEXUSFX</a>
      <h1 style={{fontSize:25,marginBottom:8}}>Subscription status</h1>
      <p style={{lineHeight:1.7,color:active?"#80d6a1":"#e7c66d"}}>{status}</p>
      {!active&&<p style={{fontSize:12,lineHeight:1.6,color:"#a3a7af"}}>NexusFX never activates access based only on the browser redirect. The signed webhook and server-side payment verification are required.</p>}
      <button disabled={busy} onClick={check} style={{width:"100%",marginTop:12,padding:12,border:0,borderRadius:7,background:"#e7c66d",fontWeight:750}}>{busy?"Checking…":"Refresh payment status"}</button>
      <a href="/portal" style={{display:"block",marginTop:16,color:"#e7c66d"}}>Continue to subscriber portal →</a>
    </section>
  </main>;
}
