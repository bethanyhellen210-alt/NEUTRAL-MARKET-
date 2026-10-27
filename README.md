# NexusFX

NexusFX is a Next.js subscriber platform for MT5 analysis and automated trading through MetaApi. It is designed for Vercel hosting; no local MT5 terminal is needed on the Vercel host.

## Implemented in the repository

- Responsive black/gold landing page with USD plan prices: $100 weekly, $400 monthly, and $1,000 yearly.
- Subscriber registration/login with bcrypt password hashing, hashed random server-side sessions, and HTTP-only cookies.
- PostgreSQL schema for users, sessions, USD subscriptions, subscriber-owned MetaApi accounts, trading settings, and trade event audit records.
- Paystack checkout initialization for USD, plus a signed webhook that independently verifies the payment with Paystack and checks reference, amount, currency and metadata before activating a subscription.
- Per-subscriber MetaApi account provisioning using a MetaApi-hosted configuration link. NexusFX does not receive or store the subscriber's MT5 password.
- Broker status/dashboard API returns account balance, equity, open positions and position P/L only for the authenticated owner's linked account.
- EMA(20)/EMA(50), RSI(14), ATR(14) technical strategy and closed-candle analysis.
- Authenticated scanner and backtest endpoints scoped to the subscriber's own linked account.
- Per-user auto-trading settings, fixed-volume cap, maximum position cap, daily-loss stop, duplicate-candle protection, broker response recording, and an emergency stop that prevents new entries.
- Vercel Cron route for the scheduled engine, guarded by a server-side bearer secret. Real order submission requires both platform-wide and user-level live-trading enablement.

## Important production gate

**Real trading is disabled by default.** Do not change `LIVE_TRADING_ENABLED` to `true` until the database is migrated, MetaApi is configured, Paystack USD acceptance is confirmed, a real account has been linked and verified, and the order/risk controls have been validated using a controlled operational test. This code is not a guarantee of profitability and is not yet independently audited. Vercel Cron runs the engine every five minutes; it is not a tick-by-tick execution service.

## Deployment

1. Import `bethanyhellen210-alt/NEUTRAL-MARKET-` into Vercel as a Next.js project.
2. Create a managed PostgreSQL database (for example, Neon or another PostgreSQL provider).
3. Run `db/schema.sql` against that database before using the portal.
4. Set the environment variables below in Vercel Project Settings → Environment Variables.
5. Deploy and open `/portal` to register a subscriber account.
6. Confirm a Paystack USD transaction can be initialized and successfully verified before offering paid subscriptions.
7. Keep live execution disabled while validating account provisioning and settings.

Terminal commands, after installing Node.js and linking Vercel:

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

## Environment variables

- `DATABASE_URL`: managed PostgreSQL connection string.
- `METAAPI_TOKEN`: server-side MetaApi token with account provisioning and trading permissions.
- `NEXUSFX_ADMIN_SECRET`: random secret for the admin sign-in shell.
- `CRON_SECRET` and `NEXUSFX_ENGINE_SECRET`: set to the same long random value; Vercel Cron sends the bearer token from `CRON_SECRET`.
- `LIVE_TRADING_ENABLED`: keep `false` until live execution is intentionally approved.
- `PAYSTACK_SECRET_KEY`: server-side payment secret.
- `PAYSTACK_PUBLIC_KEY`: payment provider public key for future client-side payment components.
- `PAYSTACK_CURRENCY`: `USD`; confirm the Paystack account supports USD transactions.
- `APP_BASE_URL`: deployed HTTPS origin, e.g. `https://your-project.vercel.app`.

Never place MetaApi tokens, Paystack secret keys, database credentials or engine secrets in browser code or GitHub.

## Subscriber and broker flow

1. Subscriber registers at `/portal`.
2. Subscriber chooses a plan; checkout creates a pending subscription.
3. Paystack webhook signature is checked and the transaction is independently verified. Only matching successful USD payments activate a subscription.
4. Subscriber connects an MT5 account. NexusFX creates a MetaApi account under its server-side MetaApi tenant and returns a MetaApi-hosted configuration link for the subscriber to enter credentials. Broker passwords are not saved by NexusFX.
5. Broker and scanner endpoints query only the MetaApi account ID associated with the current authenticated user.
6. Subscriber configures symbol, timeframe, fixed lot size, max open positions and daily-loss threshold.
7. Scheduled order execution requires all of: active verified subscription, own linked account marked connected, explicit real-account consent, user-level auto/live flags, and `LIVE_TRADING_ENABLED=true`.

## Trading engine and limits

- Signals use EMA20/EMA50 trend, RSI14 momentum, closed-candle confirmation and ATR14 reference stop/target distances.
- Fixed lot size is restricted to 0.01–0.10 lots; maximum open positions is restricted to 1–3.
- Daily loss stop is configurable from 0.5% to 2% of current balance, using realized deals plus floating P/L returned by the broker. It disables new automatic entries when hit.
- Existing positions are not automatically closed by the emergency stop.
- A unique database key blocks repeat submissions for the same subscriber/account/symbol/candle. If broker submission times out, the event is marked uncertain and must be reconciled against MT5 before retrying.
- Broker response codes are recorded; a submitted request is not treated as a guaranteed fill.
- Spread, commission, swaps, slippage, gaps, broker-specific stop-distance constraints and execution latency can materially change outcomes. The daily loss check is not a guaranteed maximum loss.
- The strategy score is condition agreement, not a calibrated probability of profit.

## Remaining operational work before enabling real money

- Run the schema migration and validate database backups, connection pooling, and account/session recovery.
- Add email verification, password reset, abuse/rate limiting and account recovery controls.
- Verify Paystack USD eligibility and complete end-to-end successful, failed, duplicate and refunded payment tests.
- Validate MetaApi hosted account configuration, supported broker symbols, actual trade result codes, stop-level rules, and all broker-specific volume/contract specifications.
- Add independent operational monitoring, incident alerts, webhook replay controls, support workflows, and an external security review.
- Forward-test strategy and loss controls on demo accounts before enabling real trading for subscribers.

## Admin

The `/admin` page currently provides a signed HTTP-only admin session shell. Database-backed admin screens for customer lookup, news publishing, access-key management, manual subscription actions and audit review still need to be built. Do not represent those features as complete yet.
