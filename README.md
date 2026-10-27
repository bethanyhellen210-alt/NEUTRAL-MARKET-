# NexusFX

NexusFX is a Next.js Forex analysis workspace intended for Vercel hosting, using MetaApi as the MT5 cloud connectivity layer. An MT5 terminal is not required on the Vercel host.

## Implemented in this repository
- Responsive robot-themed black/gold landing page with USD plans: $100 weekly, $400 monthly, and $1,000 yearly.
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
- `NEXUSFX_ADMIN_SECRET`: required for `/admin`; use a long random secret. The server issues a signed HTTP-only admin session.
- `DATABASE_URL`: required for persistent users, licenses, subscriptions and admin news (database-backed management is not implemented yet).
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`: payment provider credentials; confirm that your Paystack account is enabled to accept USD before enabling checkout.
- `PAYSTACK_CURRENCY`: `USD` for the requested pricing (provider/account eligibility must be confirmed).
- `APP_BASE_URL`: absolute deployed URL, e.g. `https://your-project.vercel.app`.
- `APP_BASE_URL`: deployed application origin.

Never put MetaApi tokens or payment secret keys in browser code or commit real secrets to GitHub.

## Admin setup
1. In Vercel, set `NEXUSFX_ADMIN_SECRET` to a long random value and redeploy.
2. Open `https://YOUR-DEPLOYMENT.vercel.app/admin` and enter that secret.
3. The current admin page verifies a signed HTTP-only session. It is an initial secure sign-in shell only; it does not yet manage news, access keys, customers, or payments because database-backed CRUD and webhook verification are still pending.

## Vercel deployment
- Import `bethanyhellen210-alt/NEUTRAL-MARKET-` into Vercel and keep the framework preset as Next.js.
- Build command: `npm run build` (default).
- Install command: `npm install` (default).
- Deploy from a terminal with `npx vercel --prod` after running `npx vercel login` and linking the project with `npx vercel`.

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
- USD payment checkout, server-verified webhooks and persistent subscription activation.
- Broker-backed account dashboard with authorization checks.
- Strategy backtesting across multiple market regimes and realistic trading costs.
- Demo-only order execution with server-side risk limits, idempotency, order reconciliation, kill switch, and tested stop-loss/target placement.
- Explicit real-account enablement after demo validation and account-mode verification.

Live order execution is intentionally disabled until these security and risk controls are implemented. Do not enable it by bypassing the lock.
