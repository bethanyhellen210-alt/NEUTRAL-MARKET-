import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCandles } from "../lib/strategy.js";

function makeCandles(count, step) {
  const rows = [];
  let close = 1.1;
  for (let i = 0; i < count; i++) {
    const open = close;
    close += step;
    rows.push({
      time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      open,
      high: Math.max(open, close) + 0.0004,
      low: Math.min(open, close) - 0.0004,
      close,
      tickVolume: 100
    });
  }
  return rows;
}

test("insufficient candles returns WAIT instead of inventing a signal", () => {
  const result = analyzeCandles(makeCandles(20, 0.0002));
  assert.equal(result.signal, "WAIT");
  assert.equal(result.candleCount, 20);
  assert.equal(result.levels, null);
});

test("strong rising candles are evaluated without claiming guaranteed profit", () => {
  const result = analyzeCandles(makeCandles(100, 0.0002));
  assert.ok(["BUY", "WAIT"].includes(result.signal));
  assert.ok(result.setupScore >= 0 && result.setupScore <= 100);
  assert.match(result.disclaimer, /not a probability of profit/i);
  if (result.signal === "BUY") {
    assert.ok(result.levels.stopLoss < result.levels.entry);
    assert.ok(result.levels.takeProfit > result.levels.entry);
  }
});

test("flat candles do not generate a directional entry", () => {
  const result = analyzeCandles(makeCandles(100, 0));
  assert.equal(result.signal, "WAIT");
});
