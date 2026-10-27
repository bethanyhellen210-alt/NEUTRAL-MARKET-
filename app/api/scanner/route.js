import MetaApi from "metaapi.cloud-sdk/esm-node";
import { analyzeCandles } from "../../../lib/strategy.js";
import { query } from "../../../lib/db.js";
import { requireUser, requireSubscription, authError } from "../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ALLOWED_SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);
const ALLOWED_TIMEFRAMES = new Set(["5m", "15m", "30m", "1h", "4h"]);
const FRAME_MS = { "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "4h": 14400000 };

export async function GET(request) {
  try {
    const user = await requireUser();
    await requireSubscription(user.id);
    const linked = await query("SELECT metaapi_account_id, status FROM broker_accounts WHERE user_id = $1 AND status <> 'revoked' ORDER BY created_at DESC LIMIT 1", [user.id]);
    if (!linked.rows[0] || linked.rows[0].status !== "connected") {
      return Response.json({ connected: false, signal: "WAIT", error: "Connect your own MT5 account first." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (!process.env.METAAPI_TOKEN) return Response.json({ connected: false, signal: "WAIT", error: "MetaApi is not configured." }, { status: 503 });
    const url = new URL(request.url);
    const symbol = (url.searchParams.get("symbol") || "EURUSD").toUpperCase();
    const timeframe = url.searchParams.get("timeframe") || "15m";
    if (!ALLOWED_SYMBOLS.has(symbol) || !ALLOWED_TIMEFRAMES.has(timeframe)) {
      return Response.json({ connected: false, signal: "WAIT", error: "Unsupported symbol or timeframe." }, { status: 400 });
    }
    const api = new MetaApi(process.env.METAAPI_TOKEN);
    const account = await api.metatraderAccountApi.getAccount(linked.rows[0].metaapi_account_id);
    if (account.state !== "DEPLOYED" || account.connectionStatus !== "CONNECTED") {
      await query("UPDATE broker_accounts SET status = 'disconnected', updated_at = NOW() WHERE user_id = $1 AND metaapi_account_id = $2", [user.id, account.id]);
      return Response.json({ connected: false, signal: "WAIT", error: "Your MT5 account is not connected in MetaApi." }, { status: 503 });
    }
    const candles = await account.getHistoricalCandles(symbol, timeframe, undefined, 250);
    const now = Date.now();
    const closed = (candles || []).filter(c => Number.isFinite(new Date(c.time).getTime()) && new Date(c.time).getTime() + FRAME_MS[timeframe] <= now);
    return Response.json({ connected: true, source: "Your linked MT5 account via MetaApi", symbol, timeframe, analyzedAt: new Date().toISOString(), ...analyzeCandles(closed) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}
