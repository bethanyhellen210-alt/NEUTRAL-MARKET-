const MIN_CANDLES = 60;

function ema(values, period) {
  if (values.length < period) return null;
  const alpha = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) value = values[i] * alpha + value * (1 - alpha);
  return value;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const previousClose = candles[i - 1].close;
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - previousClose), Math.abs(c.low - previousClose)));
  }
  return ranges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

export function analyzeCandles(inputCandles) {
  const candles = [...(inputCandles || [])]
    .filter(c => Number.isFinite(Number(c.open)) && Number.isFinite(Number(c.high)) &&
      Number.isFinite(Number(c.low)) && Number.isFinite(Number(c.close)))
    .map(c => ({ ...c, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (candles.length < MIN_CANDLES) {
    return {
      signal: "WAIT",
      setupScore: 0,
      reason: `Need at least ${MIN_CANDLES} valid candles; received ${candles.length}.`,
      indicators: null,
      levels: null,
      candleCount: candles.length
    };
  }

  const closes = candles.map(c => c.close);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const fastEma = ema(closes, 20);
  const slowEma = ema(closes, 50);
  const momentum = rsi(closes, 14);
  const volatility = atr(candles, 14);
  const precision = Math.max(0, Math.min(8, Math.max(0, ...candles.slice(-30).map(c => {
    const s = String(c.close);
    return s.includes(".") ? s.split(".")[1].length : 0;
  }))));

  const upTrend = fastEma > slowEma && last.close > fastEma;
  const downTrend = fastEma < slowEma && last.close < fastEma;
  const bullishCandle = last.close > last.open && last.close >= previous.close;
  const bearishCandle = last.close < last.open && last.close <= previous.close;
  const buyMomentum = momentum >= 50 && momentum <= 68;
  const sellMomentum = momentum <= 50 && momentum >= 32;
  const checks = [
    upTrend || downTrend,
    upTrend ? buyMomentum : downTrend ? sellMomentum : false,
    upTrend ? bullishCandle : downTrend ? bearishCandle : false,
    volatility > 0
  ];
  const setupScore = Math.round(checks.filter(Boolean).length / checks.length * 100);
  let signal = "WAIT";
  let reason = "Trend, momentum, and candle confirmation do not fully agree.";

  if (upTrend && buyMomentum && bullishCandle && volatility > 0) {
    signal = "BUY";
    reason = "EMA20 is above EMA50, price is above EMA20, RSI confirms bullish momentum, and the latest candle confirms upward pressure.";
  } else if (downTrend && sellMomentum && bearishCandle && volatility > 0) {
    signal = "SELL";
    reason = "EMA20 is below EMA50, price is below EMA20, RSI confirms bearish momentum, and the latest candle confirms downward pressure.";
  }

  const stopDistance = volatility * 1.5;
  const targetDistance = volatility * 2;
  const levels = signal === "WAIT" ? null : {
    entry: round(last.close, precision),
    stopLoss: round(signal === "BUY" ? last.close - stopDistance : last.close + stopDistance, precision),
    takeProfit: round(signal === "BUY" ? last.close + targetDistance : last.close - targetDistance, precision),
    riskReward: "1:1.33"
  };

  return {
    signal,
    setupScore,
    reason,
    candleCount: candles.length,
    indicators: {
      ema20: round(fastEma, precision),
      ema50: round(slowEma, precision),
      rsi14: round(momentum, 2),
      atr14: round(volatility, precision)
    },
    levels,
    lastCandleTime: last.time ?? null,
    disclaimer: "Technical setup only, not a probability of profit or a guarantee. Confirm spread, execution, news risk and account-specific sizing before trading."
  };
}
