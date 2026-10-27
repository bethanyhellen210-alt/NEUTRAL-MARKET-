import { query } from "../../../../lib/db.js";
import { requireUser, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    await query("UPDATE trading_settings SET auto_enabled = FALSE, live_trading_enabled = FALSE, updated_at = NOW() WHERE user_id = $1", [user.id]);
    return Response.json({ stopped: true, message: "NexusFX auto-trading disabled for this account. Existing broker positions remain open; close them in MT5 or request a separate close-position action." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}
