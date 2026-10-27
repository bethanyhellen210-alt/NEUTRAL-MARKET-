import { query } from "../../../../lib/db.js";
import { requireUser, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await query(
      "SELECT plan, currency, amount_cents, status, expires_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
      [user.id]
    );
    const active = result.rows.find(s => s.status === "active" && new Date(s.expires_at).getTime() > Date.now()) || null;
    return Response.json({ active, subscriptions: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}
