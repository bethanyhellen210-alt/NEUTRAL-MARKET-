import MetaApi from "metaapi.cloud-sdk/esm-node";
import { backtestCandles } from "../../../../lib/backtest.js";
import { query } from "../../../../lib/db.js";
import { requireUser, requireSubscription, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);
const TIMEFRAMES = new Set(["5m", "15m", "30m", "1h", "4h"]);
const FRAME_MS = { "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "4h": 14400000 };

export async function GET(request) {
  try {
    const user = await requireUser();
    await requireSubscription(user.id);
    if (!process.env.METAAPI_TOKEN) return Response.json({ error: "MetaApi is not configured." }, { status: 503 });
    const linked = await query("SELECT metaapi_account_id, status FROM broker_accounts WHERE user_id = $1 AND status <> 'revoked' ORDER BY created_at DESC LIMIT 1", [user.id]);
    if (!linked.rows[0] || linked.rows[0].status !== "connected") return Response.json({ error: "Connect your own MT5 account first." }, { status: 409 });
    const url = new URL(request.url);
    const symbol = (url.searchParams.get("symbol") || "EURUSD").toUpperCase();
    const timeframe = url.searchParams.get("timeframe") || "15m";
    if (!SYMBOLS.has(symbol) || !TIMEFRAMES.has(timeframe)) return Response.json({ error: "Unsupported symbol or timeframe." }, { status: 400 });
    const api = new MetaApi(process.env.METAAPI_TOKEN);
    const account = await api.metatraderAccountApi.getAccount(linked.rows[0].metaapi_account_id);
    if (account.state !== "DEPLOYED" || account.connectionStatus !== "CONNECTED") return Response.json({ error: "Your MT5 account is not connected." }, { status: 503 });
    const candles = await account.getHistoricalCandles(symbol, timeframe, undefined, 500);
    const closed = (candles || []).filter(c => Number.isFinite(new Date(c.time).getTime()) && new Date(c.time).getTime() + FRAME_MS[timeframe] <= Date.now());
    return Response.json({ source: "Your linked MT5 account via MetaApi", symbol, timeframe, analyzedAt: new Date().toISOString(), ...backtestCandles(closed) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}
