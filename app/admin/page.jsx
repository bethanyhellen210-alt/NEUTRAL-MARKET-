"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function checkSession() {
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = await response.json();
      setAuthenticated(Boolean(data.authenticated));
      if (data.error) setMessage(data.error);
    } catch {
      setMessage("Unable to contact the admin session service.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkSession(); }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin sign-in failed.");
      setSecret("");
      setAuthenticated(true);
      setMessage("Admin session active for up to 12 hours.");
    } catch (error) {
      setMessage(error.message || "Admin sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setMessage("Signed out.");
  }

  const box = { maxWidth: 760, margin: "32px auto", padding: 24, border: "1px solid #343434", borderRadius: 12, background: "#111317" };
  const muted = { color: "#a3a7af", lineHeight: 1.65, fontSize: 13 };
  return <main style={{ minHeight: "100vh", padding: 18, background: "#08090b", color: "#f3f1e9", fontFamily: "system-ui, sans-serif" }}>
    <header style={{ maxWidth: 760, margin: "12px auto 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div><strong style={{ letterSpacing: 2 }}>NEXUS<span style={{ color: "#e7c66d" }}>FX</span></strong><div style={{ color: "#a3a7af", fontSize: 11, marginTop: 5 }}>ADMIN CONSOLE</div></div>
      <a href="/" style={{ color: "#e7c66d", fontSize: 13 }}>Open platform ↗</a>
    </header>
    {checking ? <section style={box}>Checking admin session…</section> : authenticated ? <section style={box}>
      <h1 style={{ marginTop: 0, fontSize: 24 }}>Admin access verified</h1>
      <p style={muted}>The signed, HTTP-only admin session is active. This initial console does not yet edit users, news, access keys, or subscriptions because persistent database and payment verification are not configured.</p>
      <h2 style={{ fontSize: 16, marginTop: 26 }}>Required before managing subscriptions</h2>
      <ul style={muted}>
        <li>Configure a persistent database for users, licenses, payment references, and expiry dates.</li>
        <li>Configure the payment provider and verify signed server-side webhooks before activating a subscription.</li>
        <li>Restrict scanner and broker endpoints to authenticated users with valid entitlements.</li>
      </ul>
      <button onClick={logout} style={{ background: "#e7c66d", border: 0, borderRadius: 6, padding: "11px 16px", fontWeight: 700, cursor: "pointer" }}>Sign out</button>
    </section> : <section style={box}>
      <h1 style={{ marginTop: 0, fontSize: 24 }}>Admin sign in</h1>
      <p style={muted}>Use the value of <code>NEXUSFX_ADMIN_SECRET</code> from your Vercel server environment. Never put this secret in GitHub or expose it in public client code.</p>
      <form onSubmit={login}>
        <label htmlFor="admin-secret" style={{ display: "block", margin: "20px 0 8px", fontSize: 12 }}>Admin secret</label>
        <input id="admin-secret" type="password" autoComplete="current-password" value={secret} onChange={event => setSecret(event.target.value)} required style={{ width: "100%", boxSizing: "border-box", padding: 12, color: "#fff", background: "#08090b", border: "1px solid #41434a", borderRadius: 6 }} />
        <button disabled={busy} type="submit" style={{ marginTop: 14, width: "100%", background: "#e7c66d", border: 0, borderRadius: 6, padding: 12, fontWeight: 700, cursor: "pointer" }}>{busy ? "Verifying…" : "Sign in securely"}</button>
      </form>
    </section>}
    {message && <p role="status" style={{ maxWidth: 760, margin: "12px auto", color: "#e7c66d", fontSize: 13 }}>{message}</p>}
    <p style={{ maxWidth: 760, margin: "20px auto", color: "#767b84", fontSize: 11 }}>Admin session expires after 12 hours. Subscription and real-trading access remain disabled until backend verification is complete.</p>
  </main>;
}
