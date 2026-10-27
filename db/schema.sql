-- Run against a managed PostgreSQL database before deploying.
-- Broker passwords are never stored by NexusFX. MetaApi configuration links are used.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'yearly')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'refunded')),
  provider_reference TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON subscriptions(user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metaapi_account_id TEXT NOT NULL UNIQUE,
  broker_server TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'mt5' CHECK (platform = 'mt5'),
  account_mode TEXT NOT NULL CHECK (account_mode IN ('demo', 'real')),
  real_trading_consent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS broker_accounts_user_idx ON broker_accounts(user_id, status);

CREATE TABLE IF NOT EXISTS trading_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'EURUSD',
  timeframe TEXT NOT NULL DEFAULT '15m' CHECK (timeframe IN ('5m', '15m', '30m', '1h', '4h')),
  lot_size NUMERIC(8,2) NOT NULL DEFAULT 0.01 CHECK (lot_size >= 0.01 AND lot_size <= 0.10),
  max_open_trades INTEGER NOT NULL DEFAULT 1 CHECK (max_open_trades BETWEEN 1 AND 3),
  auto_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_trading_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_daily_loss_percent NUMERIC(4,2) NOT NULL DEFAULT 2.00 CHECK (max_daily_loss_percent BETWEEN 0.5 AND 2.0),
  last_signal_candle TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_account_id UUID NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  status TEXT NOT NULL,
  broker_order_id TEXT,
  candle_time TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, broker_account_id, symbol, candle_time)
);
CREATE INDEX IF NOT EXISTS trade_events_user_created_idx ON trade_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_news_published_idx ON admin_news(published, created_at DESC);

-- Enforce at most one active MetaApi account association per subscriber.
CREATE UNIQUE INDEX IF NOT EXISTS broker_accounts_one_active_per_user_idx ON broker_accounts(user_id) WHERE status <> 'revoked';
