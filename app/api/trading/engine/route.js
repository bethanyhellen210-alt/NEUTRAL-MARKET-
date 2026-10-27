import { randomUUID } from "node:crypto";
import MetaApi from "metaapi.cloud-sdk/esm-node";
import { getPool } from "../../../../lib/db.js";
import { analyzeCandles } from "../../../../lib/strategy.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const FRAME_MS = { "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "4h": 14400000 };
const SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);

export async function GET(request) {
  const secret = process.env.CRON_SECRET || process.env.NEXUSFX_ENGINE_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (process.env.LIVE_TRADING_ENABLED !== "true") {
    return Response.json({ enabled: false, message: "Live execution is disabled by server configuration." }, { status: 200 });
  }
  if (!process.env.METAAPI_TOKEN || !process.env.DATABASE_URL) {
    return Response.json({ error: "MetaApi and database configuration are required." }, { status: 503 });
  }
  const pool = getPool();
  const client = await pool.connect();
  const results = [];
  try {
    const users = await client.query(
      `SELECT u.id AS user_id, b.id AS broker_row_id, b.metaapi_account_id, b.account_mode, b.status AS broker_status,
              s.symbol, s.timeframe, s.lot_size, s.max_open_trades, s.max_daily_loss_percent, s.last_signal_candle
         FROM trading_settings s
         JOIN users u ON u.id = s.user_id
         JOIN broker_accounts b ON b.user_id = u.id AND b.status = 'connected'
         WHERE s.auto_enabled = TRUE AND s.live_trading_enabled = TRUE AND b.account_mode = 'real'
           AND b.real_trading_consent_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM subscriptions sub WHERE sub.user_id = u.id AND sub.status = 'active' AND sub.expires_at > NOW())`
    );
    const api = new MetaApi(process.env.METAAPI_TOKEN);
    for (const item of users.rows) {
      let eventId = null;
      try {
        if (!SYMBOLS.has(item.symbol) || !FRAME_MS[item.timeframe]) {
          results.push({ userId: item.user_id, status: "skipped_invalid_settings" });
          continue;
        }
        const account = await api.metatraderAccountApi.getAccount(item.metaapi_account_id);
        if (account.state !== "DEPLOYED" || account.connectionStatus !== "CONNECTED") {
          results.push({ userId: item.user_id, status: "skipped_account_disconnected" });
          continue;
        }
        const candles = await account.getHistoricalCandles(item.symbol, item.timeframe, undefined, 250);
        const now = Date.now();
        const closed = (candles || []).filter(c => {
          const time = new Date(c.time).getTime();
          return Number.isFinite(time) && time + FRAME_MS[item.timeframe] <= now;
        });
        const analysis = analyzeCandles(closed);
        if (analysis.signal === "WAIT" || !analysis.levels || !closed.length) {
          results.push({ userId: item.user_id, status: "no_setup", signal: analysis.signal });
          continue;
        }
        const last = closed[closed.length - 1];
        const candleTime = new Date(last.time).toISOString();
        if (item.last_signal_candle && new Date(item.last_signal_candle).getTime() >= new Date(candleTime).getTime()) {
          results.push({ userId: item.user_id, status: "already_evaluated_candle" });
          continue;
        }

        const connection = account.getRPCConnection();
        await connection.connect();
        await connection.waitSynchronized();
        const [info, positions, deals] = await Promise.all([
          connection.getAccountInformation(),
          connection.getPositions(),
          connection.getDealsByTimeRange(new Date(new Date().toISOString().slice(0,10) + "T00:00:00.000Z"), new Date())
        ]);
        const tradeDeals = (deals || []).filter(d => ["DEAL_TYPE_BUY", "DEAL_TYPE_SELL", "buy", "sell"].includes(String(d.type || "").toLowerCase()) || ["DEAL_TYPE_BUY", "DEAL_TYPE_SELL"].includes(String(d.type || "").toUpperCase()));
        const todayNet = tradeDeals.reduce((sum, d) => sum + Number(d.profit || 0) + Number(d.commission || 0) + Number(d.swap || 0), 0);
        const floating = (positions || []).reduce((sum, p) => sum + Number(p.profit || 0) + Number(p.swap || 0) + Number(p.commission || 0), 0);
        const estimatedDayStartBalance = Math.max(0, Number(info.balance) - todayNet);
        const maxLoss = estimatedDayStartBalance * Number(item.max_daily_loss_percent) / 100;
        if (todayNet + floating <= -maxLoss) {
          await client.query("UPDATE trading_settings SET auto_enabled = FALSE, live_trading_enabled = FALSE, updated_at = NOW() WHERE user_id = $1", [item.user_id]);
          await client.query(
            "INSERT INTO trade_events (user_id, broker_account_id, symbol, signal, status, candle_time, details) VALUES ($1,$2,$3,$4,'risk_stop',$5,$6::jsonb) ON CONFLICT DO NOTHING",
            [item.user_id, item.broker_row_id, item.symbol, analysis.signal, candleTime, JSON.stringify({ reason: "Daily loss limit reached", todayNet, floating, maxLoss })]
          );
          results.push({ userId: item.user_id, status: "daily_loss_limit_stop" });
          continue;
        }
        if ((positions || []).length >= Number(item.max_open_trades) || (positions || []).some(p => p.symbol === item.symbol)) {
          results.push({ userId: item.user_id, status: "position_limit_or_symbol_already_open" });
          continue;
        }
        const symbols = await connection.getSymbols();
        if (!symbols.includes(item.symbol)) {
          results.push({ userId: item.user_id, status: "broker_symbol_unavailable", symbol: item.symbol });
          continue;
        }
        const spec = await connection.getSymbolSpecification(item.symbol);
        const minVolume = Number(spec?.volumeMin ?? 0.01);
        const maxVolume = Number(spec?.volumeMax ?? 100);
        const step = Number(spec?.volumeStep ?? 0.01);
        const volume = Number(item.lot_size);
        if (!Number.isFinite(volume) || volume < minVolume || volume > Math.min(maxVolume, 0.10) || Math.abs((volume - minVolume) / step - Math.round((volume - minVolume) / step)) > 1e-6) {
          results.push({ userId: item.user_id, status: "invalid_broker_volume_step" });
          continue;
        }
        const quote = await connection.getSymbolPrice(item.symbol);
        const entry = analysis.signal === "BUY" ? Number(quote.ask) : Number(quote.bid);
        const atr = Number(analysis.indicators?.atr14);
        if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(atr) || atr <= 0) {
          results.push({ userId: item.user_id, status: "invalid_quote_or_atr" });
          continue;
        }
        const digits = Number(spec?.digits ?? 5);
        const slDistance = atr * 1.5;
        const tpDistance = atr * 2;
        const stopLoss = Number((analysis.signal === "BUY" ? entry - slDistance : entry + slDistance).toFixed(digits));
        const takeProfit = Number((analysis.signal === "BUY" ? entry + tpDistance : entry - tpDistance).toFixed(digits));
        if (stopLoss <= 0 || takeProfit <= 0 ||
            (analysis.signal === "BUY" && !(stopLoss < entry && takeProfit > entry)) ||
            (analysis.signal === "SELL" && !(takeProfit < entry && stopLoss > entry))) {
          results.push({ userId: item.user_id, status: "invalid_protective_levels" });
          continue;
        }

        const reservation = await client.query(
          `INSERT INTO trade_events (user_id, broker_account_id, symbol, signal, status, candle_time, details)
           VALUES ($1,$2,$3,$4,'submitting',$5,$6::jsonb)
           ON CONFLICT (user_id, broker_account_id, symbol, candle_time) DO NOTHING RETURNING id`,
          [item.user_id, item.broker_row_id, item.symbol, analysis.signal, candleTime, JSON.stringify({ volume, entry, stopLoss, takeProfit, timeframe: item.timeframe })]
        );
        if (!reservation.rowCount) {
          results.push({ userId: item.user_id, status: "duplicate_candle_blocked" });
          continue;
        }
        eventId = reservation.rows[0].id;
        // Persist the evaluated candle before submitting; a timeout must never cause blind retry duplicates.
        await client.query("UPDATE trading_settings SET last_signal_candle = $1, updated_at = NOW() WHERE user_id = $2", [candleTime, item.user_id]);
        const clientId = `NFX${randomUUID().replaceAll("-", "").slice(0, 20)}`;
        const order = analysis.signal === "BUY"
          ? await connection.createMarketBuyOrder(item.symbol, volume, stopLoss, takeProfit, { comment: "NexusFX auto", clientId })
          : await connection.createMarketSellOrder(item.symbol, volume, stopLoss, takeProfit, { comment: "NexusFX auto", clientId });
        const code = String(order?.stringCode || "");
        const accepted = /TRADE_RETCODE_DONE|TRADE_RETCODE_PLACED|TRADE_RETCODE_DONE_PARTIAL/i.test(code);
        await client.query(
          "UPDATE trade_events SET status = $1, broker_order_id = $2, details = details || $3::jsonb WHERE id = $4",
          [accepted ? "broker_accepted" : "broker_rejected", order?.orderId || order?.positionId || null, JSON.stringify({ brokerCode: code, numericCode: order?.numericCode ?? null, clientId }), eventId]
        );
        results.push({ userId: item.user_id, status: accepted ? "broker_accepted" : "broker_rejected", symbol: item.symbol, signal: analysis.signal, brokerCode: code });
      } catch (error) {
        if (eventId) {
          await client.query("UPDATE trade_events SET status = 'submission_unknown', details = details || $1::jsonb WHERE id = $2", [JSON.stringify({ error: "Broker request errored; manual reconciliation required before retry." }), eventId]).catch(() => {});
        }
        results.push({ userId: item.user_id, status: "error", message: "Account processing failed; inspect server logs and reconcile any uncertain order before retrying." });
      }
    }
    return Response.json({ enabled: true, processed: results.length, results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Trading engine failed. Check server configuration and database schema." }, { status: 500 });
  } finally {
    client.release();
  }
}
