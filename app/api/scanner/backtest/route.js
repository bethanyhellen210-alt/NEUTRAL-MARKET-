import MetaApi from "metaapi.cloud-sdk";
import { backtestCandles } from "../../../lib/backtest.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);
const TIMEFRAMES = new Set(["5m", "15m", "30m", "1h", "4h"]);
const FRAME_MS = { "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "4h": 14400000 };

export async function GET(request) {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  if (!token || !accountId) {
    return Response.json({ error: "Configure METAAPI_TOKEN and METAAPI_ACCOUNT_ID in server environment variables." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "EURUSD").toUpperCase();
  const timeframe = url.searchParams.get("timeframe") || "15m";
  if (!SYMBOLS.has(symbol) || !TIMEFRAMES.has(timeframe)) {
    return Response.json({ error: "Unsupported symbol or timeframe." }, { status: 400 });
  }

  try {
    const api = new MetaApi(token);
    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (account.state !== "DEPLOYED" || account.connectionStatus !== "CONNECTED") {
      return Response.json({ error: "MetaApi MT5 account is not deployed and connected.", accountState: account.state, connectionStatus: account.connectionStatus }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const rawCandles = await api.metatraderAccountApi.getHistoricalCandles(accountId, account.region, symbol, timeframe, undefined, 500);
    const cutoff = Date.now() - FRAME_MS[timeframe];
    const candles = (rawCandles || []).filter(c => Number.isFinite(new Date(c.time).getTime()) && new Date(c.time).getTime() + FRAME_MS[timeframe] <= Date.now());
    const result = backtestCandles(candles);
    return Response.json({ source: "MetaApi MT5 historical candles", symbol, timeframe, analyzedAt: new Date().toISOString(), latestCandleCutoff: new Date(cutoff).toISOString(), ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Historical backtest request failed.", detail: error instanceof Error ? error.message : "Unknown MetaApi error" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
