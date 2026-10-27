import { randomUUID } from "node:crypto";
import { query } from "../../../../lib/db.js";
import { requireUser, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = {
  weekly: { amount: 10000, days: 7 },
  monthly: { amount: 40000, days: 30 },
  yearly: { amount: 100000, days: 365 }
};

export async function POST(request) {
  try {
    const user = await requireUser();
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return Response.json({ error: "USD checkout is not configured. Set PAYSTACK_SECRET_KEY in Vercel." }, { status: 503 });
    const body = await request.json();
    const plan = String(body?.plan || "").toLowerCase();
    if (!PLANS[plan]) return Response.json({ error: "Choose weekly, monthly, or yearly." }, { status: 400 });
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return Response.json({ error: "Set APP_BASE_URL to the HTTPS deployment URL." }, { status: 503 });
    const reference = `nexusfx_${randomUUID().replaceAll("-", "")}`;
    const planData = PLANS[plan];
    const inserted = await query(
      `INSERT INTO subscriptions (user_id, plan, amount_cents, currency, status, provider_reference)
       VALUES ($1, $2, $3, 'USD', 'pending', $4) RETURNING id`,
      [user.id, plan, planData.amount, reference]
    );
    const provider = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: planData.amount,
        currency: "USD",
        reference,
        callback_url: `${baseUrl.replace(/\/$/, "")}/subscription/verify`,
        metadata: { nexusfxSubscriptionId: inserted.rows[0].id, userId: user.id, plan }
      }),
      cache: "no-store"
    });
    const data = await provider.json();
    if (!provider.ok || !data.status || !data.data?.authorization_url) {
      await query("UPDATE subscriptions SET status = 'cancelled' WHERE id = $1", [inserted.rows[0].id]);
      return Response.json({ error: data.message || "Payment provider did not initialize checkout. Verify USD is enabled for your Paystack account." }, { status: 502 });
    }
    return Response.json({ checkoutUrl: data.data.authorization_url, reference, plan, currency: "USD", amountCents: planData.amount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authError(error);
  }
}
