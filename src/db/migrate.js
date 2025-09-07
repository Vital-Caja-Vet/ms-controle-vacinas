const { _pool: pool } = require('../store/db');

async function migrate() {
  // Create extensions if needed (pgcrypto for gen_random_uuid), but keep UUID client-side for compatibility
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      batch TEXT NOT NULL,
      expiration_date TIMESTAMPTZ NOT NULL,
      stock_quantity INTEGER NOT NULL,
      min_stock_threshold INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id UUID PRIMARY KEY,
      animal_id TEXT NOT NULL,
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      dose_quantity INTEGER NOT NULL CHECK (dose_quantity > 0),
      date TIMESTAMPTZ NOT NULL,
      user_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { migrate };

