"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [secret,setSecret]=useState("");
  const [authenticated,setAuthenticated]=useState(false);
  const [checking,setChecking]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [news,setNews]=useState([]);
  const [subscribers,setSubscribers]=useState([]);

  const box={maxWidth:900,margin:"20px auto",padding:20,border:"1px solid #343434",borderRadius:12,background:"#111317"};
  const muted={color:"#a3a7af",lineHeight:1.65,fontSize:13};
  const field={width:"100%",boxSizing:"border-box",padding:12,color:"#fff",background:"#08090b",border:"1px solid #41434a",borderRadius:6,marginTop:6};

  async function api(path,options={}) {
    const response=await fetch(path,{...options,cache:"no-store",headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({error:"Invalid server response"}));
    if(!response.ok)throw new Error(data.error||"Request failed");
    return data;
  }
  async function loadAdminData() {
    try {
      const [n,s]=await Promise.all([api("/api/admin/news"),api("/api/admin/subscriptions")]);
      setNews(n.items||[]);setSubscribers(s.subscribers||[]);
    } catch(e) { setMessage(e.message||"Unable to load admin data. Run db/schema.sql first."); }
  }
  async function checkSession() {
    try {
      const response=await fetch("/api/admin/session",{cache:"no-store"});
      const data=await response.json();
      setAuthenticated(Boolean(data.authenticated));
      if(data.error)setMessage(data.error);
      if(data.authenticated)await loadAdminData();
    } catch {setMessage("Unable to contact the admin session service.");}
    finally {setChecking(false);}
  }
  useEffect(()=>{checkSession();},[]);

  async function login(event) {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      await api("/api/admin/session",{method:"POST",body:JSON.stringify({secret})});
      setSecret("");setAuthenticated(true);setMessage("Admin session active for up to 12 hours.");await loadAdminData();
    } catch(e) {setMessage(e.message||"Admin sign-in failed.");}
    finally {setBusy(false);}
  }
  async function publish(event) {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      await api("/api/admin/news",{method:"POST",body:JSON.stringify({title,body})});
      setTitle("");setBody("");setMessage("Announcement published.");await loadAdminData();
    } catch(e) {setMessage(e.message);}
    finally {setBusy(false);}
  }
  async function deleteNews(id) {
    if(!window.confirm("Delete this announcement?"))return;
    try {await api("/api/admin/news?id="+encodeURIComponent(id),{method:"DELETE"});await loadAdminData();setMessage("Announcement deleted.");}
    catch(e){setMessage(e.message);}
  }
  async function logout() {
    await fetch("/api/admin/session",{method:"DELETE"});
    setAuthenticated(false);setNews([]);setSubscribers([]);setMessage("Signed out.");
  }

  return <main style={{minHeight:"100vh",padding:18,background:"#08090b",color:"#f3f1e9",fontFamily:"system-ui,sans-serif"}}>
    <header style={{maxWidth:900,margin:"12px auto 24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div><strong style={{letterSpacing:2}}>NEXUS<span style={{color:"#e7c66d"}}>FX</span></strong><div style={{color:"#a3a7af",fontSize:11,marginTop:5}}>ADMIN CONSOLE</div></div>
      <a href="/" style={{color:"#e7c66d",fontSize:13}}>Open platform ↗</a>
    </header>
    {checking?<section style={box}>Checking admin session…</section>:authenticated?<>
      <section style={box}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><h1 style={{margin:"0 0 5px",fontSize:24}}>Admin dashboard</h1><p style={muted}>Manage public announcements and review subscriber entitlements.</p></div>
          <button onClick={logout} style={{background:"#e7c66d",border:0,borderRadius:6,padding:"11px 16px",fontWeight:700,cursor:"pointer"}}>Sign out</button>
        </div>
      </section>
      <section style={box}>
        <h2 style={{fontSize:18,marginTop:0}}>Publish news</h2>
        <form onSubmit={publish}>
          <label style={{display:"block",fontSize:12}}>Announcement title<input style={field} value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required/></label>
          <label style={{display:"block",fontSize:12,marginTop:12}}>Announcement body<textarea style={{...field,minHeight:120,resize:"vertical"}} value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} required/></label>
          <button disabled={busy} style={{marginTop:12,background:"#e7c66d",border:0,borderRadius:6,padding:12,fontWeight:700,cursor:"pointer"}}>{busy?"Saving…":"Publish announcement"}</button>
        </form>
        <h3 style={{fontSize:15,marginTop:26}}>Recent announcements</h3>
        {news.length===0?<p style={muted}>No announcements yet.</p>:news.map(item=><article key={item.id} style={{borderTop:"1px solid #343434",padding:"12px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><strong>{item.title}</strong><button onClick={()=>deleteNews(item.id)} style={{background:"transparent",border:"1px solid #62413e",color:"#ffb3ad",padding:"6px 9px",borderRadius:5}}>Delete</button></div>
          <p style={{...muted,whiteSpace:"pre-wrap"}}>{item.body}</p><small style={{color:"#777"}}>{new Date(item.created_at).toLocaleString()}</small>
        </article>)}
      </section>
      <section style={box}>
        <h2 style={{fontSize:18,marginTop:0}}>Subscribers & subscriptions</h2>
        <p style={muted}>Read-only overview. Subscription access is activated by verified Paystack webhooks, not by editing a browser field.</p>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Email","Plan","Amount","Status","Expires"].map(x=><th key={x} style={{textAlign:"left",padding:9,borderBottom:"1px solid #454545",color:"#e7c66d"}}>{x}</th>)}</tr></thead>
          <tbody>{subscribers.map(s=><tr key={s.user_id}><td style={{padding:9,borderBottom:"1px solid #292929"}}>{s.email}</td><td style={{padding:9,borderBottom:"1px solid #292929"}}>{s.plan||"—"}</td><td style={{padding:9,borderBottom:"1px solid #292929"}}>{s.amount_cents==null?"—":(Number(s.amount_cents)/100).toLocaleString("en-US",{style:"currency",currency:s.currency||"USD"})}</td><td style={{padding:9,borderBottom:"1px solid #292929"}}>{s.subscription_status||"none"}</td><td style={{padding:9,borderBottom:"1px solid #292929"}}>{s.expires_at?new Date(s.expires_at).toLocaleDateString():"—"}</td></tr>)}</tbody>
        </table></div>
        <button onClick={loadAdminData} style={{marginTop:12,background:"transparent",color:"#e7c66d",border:"1px solid #454545",borderRadius:6,padding:10}}>Refresh data</button>
      </section>
    </>:<section style={box}>
      <h1 style={{marginTop:0,fontSize:24}}>Admin sign in</h1>
      <p style={muted}>Use the value of <code>NEXUSFX_ADMIN_SECRET</code> from Vercel server environment. Never put this secret in GitHub or public client code.</p>
      <form onSubmit={login}>
        <label htmlFor="admin-secret" style={{display:"block",margin:"20px 0 8px",fontSize:12}}>Admin secret</label>
        <input id="admin-secret" type="password" autoComplete="current-password" value={secret} onChange={e=>setSecret(e.target.value)} required style={field}/>
        <button disabled={busy} type="submit" style={{marginTop:14,width:"100%",background:"#e7c66d",border:0,borderRadius:6,padding:12,fontWeight:700,cursor:"pointer"}}>{busy?"Verifying…":"Sign in securely"}</button>
      </form>
    </section>}
    {message&&<p role="status" style={{maxWidth:900,margin:"12px auto",color:"#e7c66d",fontSize:13,overflowWrap:"anywhere"}}>{message}</p>}
    <p style={{maxWidth:900,margin:"20px auto",color:"#767b84",fontSize:11}}>Admin session expires after 12 hours. Subscriber data is accessible only through the authenticated admin API.</p>
  </main>;
}
