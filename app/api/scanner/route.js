import MetaApi from "metaapi.cloud-sdk";
import { analyzeCandles } from "../../../lib/strategy.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD"]);
const ALLOWED_TIMEFRAMES = new Set(["5m", "15m", "30m", "1h", "4h"]);

export async function GET(request) {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  if (!token || !accountId) {
    return Response.json({
      connected: false,
      error: "Scanner needs a MetaApi token and MT5 account ID configured as server environment variables.",
      signal: "WAIT"
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "EURUSD").toUpperCase();
  const timeframe = url.searchParams.get("timeframe") || "15m";
  if (!ALLOWED_SYMBOLS.has(symbol) || !ALLOWED_TIMEFRAMES.has(timeframe)) {
    return Response.json({ connected: false, error: "Unsupported symbol or timeframe.", signal: "WAIT" }, { status: 400 });
  }

  try {
    const api = new MetaApi(token);
    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (account.state !== "DEPLOYED" || account.connectionStatus !== "CONNECTED") {
      return Response.json({
        connected: false,
        error: "The configured MT5 account is not deployed and connected in MetaApi.",
        accountState: account.state,
        connectionStatus: account.connectionStatus,
        signal: "WAIT"
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const candles = await api.metatraderAccountApi.getHistoricalCandles(
      accountId,
      account.region,
      symbol,
      timeframe,
      undefined,
      250
    );
    const timeframeMs = ({ "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000, "4h": 14400000 })[timeframe];
    const now = Date.now();
    // Avoid signals based on a candle that is still forming (which can repaint).
    const closedCandles = (candles || []).filter(candle => {
      const openedAt = new Date(candle.time).getTime();
      return Number.isFinite(openedAt) && openedAt + timeframeMs <= now;
    });
    const analysis = analyzeCandles(closedCandles);
    return Response.json({
      connected: true,
      source: "MetaApi MT5 historical candles",
      symbol,
      timeframe,
      analyzedAt: new Date().toISOString(),
      ...analysis
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      connected: false,
      signal: "WAIT",
      error: "Live scanner request failed.",
      detail: error instanceof Error ? error.message : "Unknown MetaApi error"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
