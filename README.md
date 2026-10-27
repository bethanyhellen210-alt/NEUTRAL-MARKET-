# NexusFX

NexusFX is a Forex automation platform scaffold built for Vercel, with MetaApi as the MT5 connectivity layer. The MT5 terminal is not required on the Vercel host.

## Included in the initial scaffold
- Robot-led subscription/access landing page (weekly 100, monthly 400, yearly 1,000; currency must be confirmed before payments are enabled).
- Dashboard, Auto Trade, Scanner, Broker, Settings and admin-managed News sections.
- Explicit Demo/Real mode selection; live trading stays disabled until broker connectivity, strategy, and risk controls are verified.
- Server-only MetaApi environment variables; no tokens in browser code.

## Deploy
1. Import this repository into Vercel.
2. Use the default Next.js build settings (`npm run build`).
3. Add server-side environment variables from `.env.example` in Vercel.
4. Redeploy after adding variables.

## MetaApi setup
Create/authorize an MT5 account in your MetaApi account, then set `METAAPI_TOKEN` and `METAAPI_ACCOUNT_ID` in Vercel. Do not expose the token to the browser. Account data must be fetched and validated from MetaApi before being shown as live.

## Important status
The initial UI scaffold does not yet place real orders, verify payments, or authenticate users against a database. Those features require the next implementation steps: persistent database/auth, verified Paystack checkout/webhooks, MetaApi account-state endpoints, strategy testing, and order/risk controls. Never enable live trading until demo execution and protective limits are tested.

Subscription price numbers are provisional and have no currency attached yet. Payment processing is intentionally not enabled until the currency and checkout requirements are confirmed.
