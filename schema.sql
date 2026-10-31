-- OGS Online – schéma Postgres / Supabase.
-- Exécuté automatiquement au démarrage du serveur (idempotent), ou à coller dans l'éditeur SQL de Supabase.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  trophies      INTEGER NOT NULL DEFAULT 0,
  best_trophies INTEGER NOT NULL DEFAULT 0,
  xp            INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 50,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  draws         INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  equipped      JSONB NOT NULL DEFAULT '{}'::jsonb,
  skins         JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_daily    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS survival_best INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quests JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transfer_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transfer_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_modo BOOLEAN NOT NULL DEFAULT false;
-- Anciennes colonnes de comptes (mot de passe, Google) : rendues facultatives puis ignorées.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';
DROP INDEX IF EXISTS users_google_sub;
ALTER TABLE users DROP COLUMN IF EXISTS google_sub;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
CREATE UNIQUE INDEX IF NOT EXISTS users_transfer_code ON users (transfer_code) WHERE transfer_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
CREATE INDEX IF NOT EXISTS users_trophies ON users (trophies DESC, wins DESC);

CREATE TABLE IF NOT EXISTS matches (
  id         SERIAL PRIMARY KEY,
  mode       TEXT NOT NULL,            -- ranked | bot | friendly
  p1_id      INTEGER,                  -- NULL pour un bot
  p2_id      INTEGER,
  p1_name    TEXT NOT NULL,
  p2_name    TEXT NOT NULL,
  winner     TEXT NOT NULL,            -- p1 | p2 | draw
  reason     TEXT NOT NULL,            -- ko | time | surrender | disconnect
  duration   REAL NOT NULL DEFAULT 0,
  p1_delta   INTEGER NOT NULL DEFAULT 0,
  p2_delta   INTEGER NOT NULL DEFAULT 0,
  stats      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_p1 ON matches (p1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_p2 ON matches (p2_id, created_at DESC);
