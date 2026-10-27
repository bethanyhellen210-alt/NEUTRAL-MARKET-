import { query } from "../../../../lib/db.js";
import { requireUser, requireSubscription, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    await requireSubscription(user.id);
    const result = await query(
      "SELECT symbol, timeframe, lot_size, max_open_trades, auto_enabled, live_trading_enabled, max_daily_loss_percent, updated_at FROM trading_settings WHERE user_id = $1",
      [user.id]
    );
    return Response.json({ settings: result.rows[0] || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}

export async function POST(request) {
  try {
    const user = await requireUser();
    await requireSubscription(user.id);
    const body = await request.json();
    const symbol = String(body?.symbol || "EURUSD").toUpperCase();
    const timeframe = String(body?.timeframe || "15m");
    const lotSize = Number(body?.lotSize);
    const maxOpenTrades = Number(body?.maxOpenTrades);
    const maxDailyLossPercent = Number(body?.maxDailyLossPercent ?? 2);
    const validSymbols = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);
    const validFrames = new Set(["5m", "15m", "30m", "1h", "4h"]);
    if (!validSymbols.has(symbol) || !validFrames.has(timeframe) ||
        !Number.isFinite(lotSize) || lotSize < 0.01 || lotSize > 0.10 ||
        !Number.isInteger(maxOpenTrades) || maxOpenTrades < 1 || maxOpenTrades > 3 ||
        !Number.isFinite(maxDailyLossPercent) || maxDailyLossPercent < 0.5 || maxDailyLossPercent > 2) {
      return Response.json({ error: "Invalid settings. Lot size: 0.01–0.10; max open trades: 1–3; daily loss limit: 0.5–2%." }, { status: 400 });
    }
    const wantsAuto = body?.autoEnabled === true;
    const wantsLive = body?.liveTradingEnabled === true;
    if (wantsLive && (body?.confirmRealTrading !== true || process.env.LIVE_TRADING_ENABLED !== "true")) {
      return Response.json({ error: "Live trading needs explicit consent and LIVE_TRADING_ENABLED=true after production verification. It remains disabled." }, { status: 403 });
    }
    const account = await query("SELECT account_mode, status FROM broker_accounts WHERE user_id = $1 AND status <> 'revoked' ORDER BY created_at DESC LIMIT 1", [user.id]);
    if (wantsAuto && !account.rows[0]) return Response.json({ error: "Connect your own MT5 account first." }, { status: 409 });
    if (wantsLive && (account.rows[0]?.account_mode !== "real" || account.rows[0]?.status !== "connected")) {
      return Response.json({ error: "A connected, explicitly authorized real MT5 account is required." }, { status: 409 });
    }
    const result = await query(
      `INSERT INTO trading_settings (user_id, symbol, timeframe, lot_size, max_open_trades, auto_enabled, live_trading_enabled, max_daily_loss_percent, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (user_id) DO UPDATE SET symbol=EXCLUDED.symbol, timeframe=EXCLUDED.timeframe,
       lot_size=EXCLUDED.lot_size, max_open_trades=EXCLUDED.max_open_trades,
       auto_enabled=EXCLUDED.auto_enabled, live_trading_enabled=EXCLUDED.live_trading_enabled,
       max_daily_loss_percent=EXCLUDED.max_daily_loss_percent, updated_at=NOW()
       RETURNING symbol, timeframe, lot_size, max_open_trades, auto_enabled, live_trading_enabled, max_daily_loss_percent, updated_at`,
      [user.id, symbol, timeframe, lotSize, maxOpenTrades, wantsAuto, wantsLive, maxDailyLossPercent]
    );
    return Response.json({ settings: result.rows[0], message: wantsAuto ? "Auto-trading setting saved. Orders still require the scheduled engine and all server-side safeguards." : "Auto-trading stopped." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authError(error); }
}
