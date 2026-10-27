import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesSignature(raw, signature, secret) {
  if (!signature) return false;
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return Response.json({ error: "Payment provider is not configured." }, { status: 503 });
  const raw = await request.text();
  if (!matchesSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (event?.event !== "charge.success" || !event?.data?.reference) return Response.json({ received: true });
  try {
    const reference = String(event.data.reference);
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }, cache: "no-store"
    });
    const verified = await verifyResponse.json();
    if (!verifyResponse.ok || !verified.status || verified.data?.status !== "success" ||
        verified.data?.currency !== "USD" || Number(verified.data?.amount) <= 0) {
      return Response.json({ error: "Payment verification failed." }, { status: 400 });
    }
    const client = await import("../../../../lib/db.js").then(m => m.getPool());
    const tx = await client.connect();
    try {
      await tx.query("BEGIN");
      const subResult = await tx.query(
        "SELECT id, user_id, plan, amount_cents, currency, status FROM subscriptions WHERE provider_reference = $1 FOR UPDATE",
        [reference]
      );
      const sub = subResult.rows[0];
      if (!sub) { await tx.query("ROLLBACK"); return Response.json({ error: "Unknown subscription reference." }, { status: 404 }); }
      if (sub.status === "active") { await tx.query("COMMIT"); return Response.json({ received: true, alreadyProcessed: true }); }
      if (sub.currency !== "USD" || Number(sub.amount_cents) !== Number(verified.data.amount) ||
          Number(sub.amount_cents) !== Number(event.data.amount) ||
          String(verified.data.metadata?.userId || "") !== String(sub.user_id) ||
          String(verified.data.metadata?.plan || "") !== sub.plan) {
        await tx.query("ROLLBACK");
        return Response.json({ error: "Payment amount, currency, or metadata mismatch." }, { status: 400 });
      }
      const days = ({ weekly: 7, monthly: 30, yearly: 365 })[sub.plan];
      const active = await tx.query(
        `UPDATE subscriptions SET status = 'active',
           expires_at = NOW() + ($2 * INTERVAL '1 day')
         WHERE id = $1 AND status = 'pending'
         RETURNING id, user_id, plan, expires_at`,
        [sub.id, days]
      );
      if (!active.rowCount) { await tx.query("ROLLBACK"); return Response.json({ received: true, alreadyProcessed: true }); }
      await tx.query("COMMIT");
      return Response.json({ received: true, activated: true });
    } catch (error) {
      await tx.query("ROLLBACK");
      throw error;
    } finally {
      tx.release();
    }
  } catch {
    return Response.json({ error: "Could not process verified payment webhook." }, { status: 500 });
  }
}
