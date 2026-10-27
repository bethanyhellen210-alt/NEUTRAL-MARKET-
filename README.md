# NexusFX

NexusFX is a Next.js Forex analysis workspace intended for Vercel hosting, using MetaApi as the MT5 cloud connectivity layer. An MT5 terminal is not required on the Vercel host.

## Implemented in this repository
- Responsive robot-themed black/gold landing page and provisional weekly/monthly/yearly plan cards.
- Workspace navigation: Dashboard, Auto Trade, Scanner, Broker, Settings, News.
- EMA(20)/EMA(50), RSI(14), ATR(14) technical setup engine.
- Scanner API reads historical MT5 candles through the official MetaApi Node SDK, rejects unsupported symbol/timeframe inputs, and excludes the still-forming candle.
- Conservative OHLC backtest endpoint with win rate, profit factor, expectancy in R, net R and maximum drawdown in R.
- Unit tests and GitHub Actions build/test workflow.
- Order execution remains locked; the UI does not fabricate account balances, signals, trades or payment confirmations.

## Required Vercel environment variables
Set these under **Project → Settings → Environment Variables**:

- `METAAPI_TOKEN`: server-side MetaApi API token.
- `METAAPI_ACCOUNT_ID`: MT5 account already added and deployed in MetaApi.
- `NEXUSFX_ADMIN_SECRET`: reserve for a future protected admin API.
- `DATABASE_URL`: reserve for persistent users, licenses and admin news.
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`: reserve for payment integration after currency/checkout requirements are confirmed.
- `APP_BASE_URL`: deployed application origin.

Never put MetaApi tokens or payment secret keys in browser code or commit real secrets to GitHub.

## Scanner setup
1. Create/authorize the MT5 account in MetaApi and wait for it to be deployed and connected.
2. Add `METAAPI_TOKEN` and `METAAPI_ACCOUNT_ID` in Vercel.
3. Redeploy.
4. Open Scanner, choose a supported symbol/timeframe and run analysis. If the broker uses a different symbol suffix (for example, `EURUSD.a`), configure the broker's exact symbol mapping before scanning that instrument.

The strategy currently uses:
- EMA 20 / EMA 50 for trend direction.
- RSI 14 for momentum confirmation.
- Closed-candle direction for confirmation.
- ATR 14 for reference stop-loss and take-profit distances (1.5 × ATR and 2 × ATR).

A BUY/SELL is a technical setup, not a probability of profit. The setup score is condition agreement only, not a calibrated probability.

## Backtesting limitations
The backtest enters at the next candle open, uses ATR-based stops/targets, and conservatively assumes stop-loss first if both stop and target are touched in the same candle. It does not model spread, commission, swap, slippage, latency, or broker execution. Backtest results are not proof of future profitability; use out-of-sample testing and demo forward-testing before considering live trading.

## Still required before this is a complete commercial auto-trader
- Secure user registration/session authentication and per-user broker account ownership.
- Persistent database and protected admin news publishing.
- Verified access-key licenses and subscription entitlement checks.
- Payment checkout plus server-verified webhooks; displayed prices are provisional until currency is confirmed.
- Broker-backed account dashboard with authorization checks.
- Strategy backtesting across multiple market regimes and realistic trading costs.
- Demo-only order execution with server-side risk limits, idempotency, order reconciliation, kill switch, and tested stop-loss/target placement.
- Explicit real-account enablement after demo validation and account-mode verification.

Live order execution is intentionally disabled until these security and risk controls are implemented. Do not enable it by bypassing the lock.
