import { analyzeCandles } from "./strategy.js";

function normalize(candles) {
  return [...(candles || [])]
    .filter(c => Number.isFinite(Number(c.open)) && Number.isFinite(Number(c.high)) &&
      Number.isFinite(Number(c.low)) && Number.isFinite(Number(c.close)) && Number.isFinite(new Date(c.time).getTime()))
    .map(c => ({ ...c, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Conservative OHLC backtest: enter at the next candle open; use ATR-based
 * stops/targets; if both levels are touched in one candle, count the stop first.
 * Spread, commission, swap, slippage and broker execution are not modeled.
 */
export function backtestCandles(input, options = {}) {
  const candles = normalize(input);
  const warmup = Math.max(60, Number(options.warmup) || 60);
  if (candles.length <= warmup + 2) {
    return { status: "insufficient_data", candleCount: candles.length, requiredCandles: warmup + 3, trades: 0, winRate: null, profitFactor: null, expectancyR: null, maxDrawdownR: null };
  }

  const results = [];
  let i = warmup;
  while (i < candles.length - 1) {
    const setup = analyzeCandles(candles.slice(0, i + 1));
    if (setup.signal === "WAIT" || !setup.indicators?.atr14) {
      i += 1;
      continue;
    }

    const entryIndex = i + 1;
    const entry = candles[entryIndex].open;
    const atrValue = setup.indicators.atr14;
    const stopDistance = atrValue * 1.5;
    const targetDistance = atrValue * 2;
    if (!(entry > 0) || !(stopDistance > 0)) {
      i += 1;
      continue;
    }

    const direction = setup.signal;
    const stop = direction === "BUY" ? entry - stopDistance : entry + stopDistance;
    const target = direction === "BUY" ? entry + targetDistance : entry - targetDistance;
    let outcome = null;
    let exitIndex = entryIndex;
    for (let j = entryIndex; j < candles.length; j++) {
      const candle = candles[j];
      const hitStop = direction === "BUY" ? candle.low <= stop : candle.high >= stop;
      const hitTarget = direction === "BUY" ? candle.high >= target : candle.low <= target;
      if (hitStop) {
        outcome = { resultR: -1, exit: stop, reason: hitTarget ? "stop_first_same_candle" : "stop_loss" };
        exitIndex = j;
        break;
      }
      if (hitTarget) {
        outcome = { resultR: targetDistance / stopDistance, exit: target, reason: "take_profit" };
        exitIndex = j;
        break;
      }
    }

    if (outcome) {
      results.push({
        direction,
        entryTime: candles[entryIndex].time,
        exitTime: candles[exitIndex].time,
        entry,
        exit: outcome.exit,
        resultR: outcome.resultR,
        reason: outcome.reason
      });
      i = exitIndex + 1;
    } else {
      // Ignore still-open trades rather than pretending they were closed profitably.
      break;
    }
  }

  const wins = results.filter(t => t.resultR > 0).length;
  const losses = results.filter(t => t.resultR < 0).length;
  const grossProfit = results.filter(t => t.resultR > 0).reduce((s, t) => s + t.resultR, 0);
  const grossLoss = Math.abs(results.filter(t => t.resultR < 0).reduce((s, t) => s + t.resultR, 0));
  const expectancyR = results.length ? results.reduce((s, t) => s + t.resultR, 0) / results.length : null;
  let equityR = 0;
  let peakR = 0;
  let maxDrawdownR = 0;
  for (const trade of results) {
    equityR += trade.resultR;
    peakR = Math.max(peakR, equityR);
    maxDrawdownR = Math.max(maxDrawdownR, peakR - equityR);
  }

  return {
    status: "complete",
    candleCount: candles.length,
    trades: results.length,
    wins,
    losses,
    winRate: results.length ? Number((wins / results.length * 100).toFixed(2)) : null,
    profitFactor: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit ? "infinite_no_losses" : null,
    expectancyR: expectancyR === null ? null : Number(expectancyR.toFixed(3)),
    netR: Number(results.reduce((s, t) => s + t.resultR, 0).toFixed(2)),
    maxDrawdownR: Number(maxDrawdownR.toFixed(2)),
    sampleTrades: results.slice(-20),
    assumptions: [
      "Historical OHLC candles only; no spread, commission, swap, slippage or latency.",
      "Entries occur at the next candle open after a completed signal candle.",
      "If stop-loss and take-profit are both touched within one candle, stop-loss is assumed first.",
      "This is a historical simulation, not a promise of future performance."
    ]
  };
}
