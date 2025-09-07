const { Pool } = require('pg');
const crypto = require('crypto');

// Prefer standard PG env vars; allow DB_* aliases
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || process.env.DB_HOST || undefined,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.PGUSER || process.env.DB_USER || undefined,
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || undefined,
  database: process.env.PGDATABASE || process.env.DB_NAME || undefined,
});

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    batch: row.batch,
    expirationDate: row.expiration_date ? new Date(row.expiration_date).toISOString() : null,
    stockQuantity: Number(row.stock_quantity),
    minStockThreshold: Number(row.min_stock_threshold || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    animalId: row.animal_id,
    itemId: row.item_id,
    doseQuantity: Number(row.dose_quantity),
    date: row.date ? new Date(row.date).toISOString() : null,
    userId: row.user_id || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}

// Items
async function listItems() {
  const { rows } = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
  return rows.map(mapItem);
}

async function getItem(id) {
  const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  return mapItem(rows[0]);
}

async function createItem(item) {
  const id = uuid();
  const { rows } = await pool.query(
    `INSERT INTO items (id, name, manufacturer, batch, expiration_date, stock_quantity, min_stock_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      id,
      item.name,
      item.manufacturer,
      item.batch,
      item.expirationDate,
      item.stockQuantity,
      item.minStockThreshold || 0,
    ],
  );
  return mapItem(rows[0]);
}

async function updateItem(id, updates) {
  const sets = [];
  const vals = [];
  let n = 1;
  function addSet(col, val) {
    sets.push(`${col} = $${n++}`);
    vals.push(val);
  }
  if (updates.name != null) addSet('name', updates.name);
  if (updates.manufacturer != null) addSet('manufacturer', updates.manufacturer);
  if (updates.batch != null) addSet('batch', updates.batch);
  if (updates.expirationDate != null) addSet('expiration_date', updates.expirationDate);
  if (updates.stockQuantity != null) addSet('stock_quantity', updates.stockQuantity);
  if (updates.minStockThreshold != null) addSet('min_stock_threshold', updates.minStockThreshold);

  if (!sets.length) {
    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    return mapItem(rows[0]);
  }

  const sql = `UPDATE items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${n} RETURNING *`;
  vals.push(id);
  const { rows } = await pool.query(sql, vals);
  return mapItem(rows[0]);
}

async function deleteItem(id) {
  const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [id]);
  return rowCount > 0;
}

// Applications
async function listApplications() {
  const { rows } = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
  return rows.map(mapApplication);
}

async function getApplication(id) {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  return mapApplication(rows[0]);
}

async function createApplicationWithStock({ animalId, itemId, doseQuantity, date, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: itemRows } = await client.query('SELECT * FROM items WHERE id = $1 FOR UPDATE', [itemId]);
    const item = itemRows[0];
    if (!item) throw new Error('Item not found');
    const now = new Date();
    const exp = new Date(item.expiration_date);
    if (exp.getTime() <= now.getTime()) throw new Error('Item is expired');
    if (Number(item.stock_quantity) < doseQuantity) throw new Error('Insufficient stock');

    const newQty = Number(item.stock_quantity) - doseQuantity;
    await client.query('UPDATE items SET stock_quantity = $1, updated_at = NOW() WHERE id = $2', [newQty, itemId]);

    const id = uuid();
    const { rows: appRows } = await client.query(
      `INSERT INTO applications (id, animal_id, item_id, dose_quantity, date, user_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, animalId, itemId, doseQuantity, date || new Date().toISOString(), userId || null],
    );
    await client.query('COMMIT');
    return { application: mapApplication(appRows[0]) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function updateApplicationWithStock(id, updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: currentRows } = await client.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [id]);
    const current = currentRows[0];
    if (!current) return null;

    let newItemId = updates.itemId != null ? updates.itemId : current.item_id;
    let newDose = updates.doseQuantity != null ? Number(updates.doseQuantity) : Number(current.dose_quantity);
    if (!Number.isFinite(newDose) || newDose <= 0) throw new Error('Invalid doseQuantity');

    // If item or dose changed, adjust stocks
    if (newItemId !== current.item_id || newDose !== Number(current.dose_quantity)) {
      // Restore stock on old item
      await client.query('UPDATE items SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [
        Number(current.dose_quantity),
        current.item_id,
      ]);
      // Validate new item
      const { rows: itemRows } = await client.query('SELECT * FROM items WHERE id = $1 FOR UPDATE', [newItemId]);
      const item = itemRows[0];
      if (!item) throw new Error('Item not found');
      const now = new Date();
      const exp = new Date(item.expiration_date);
      if (exp.getTime() <= now.getTime()) throw new Error('Item is expired');
      if (Number(item.stock_quantity) < newDose) throw new Error('Insufficient stock');
      // Debit new stock
      await client.query('UPDATE items SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [
        newDose,
        newItemId,
      ]);
    }

    const sets = [];
    const vals = [];
    let n = 1;
    function addSet(col, val) {
      sets.push(`${col} = $${n++}`);
      vals.push(val);
    }
    if (updates.animalId != null) addSet('animal_id', updates.animalId);
    if (updates.itemId != null) addSet('item_id', updates.itemId);
    if (updates.doseQuantity != null) addSet('dose_quantity', newDose);
    if (updates.date != null) addSet('date', updates.date);
    if (updates.userId != null) addSet('user_id', updates.userId);

    if (sets.length === 0) {
      const { rows } = await client.query('SELECT * FROM applications WHERE id = $1', [id]);
      await client.query('COMMIT');
      return mapApplication(rows[0]);
    }

    const sql = `UPDATE applications SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`;
    vals.push(id);
    const { rows } = await client.query(sql, vals);
    await client.query('COMMIT');
    return mapApplication(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deleteApplicationWithStock(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: currentRows } = await client.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [id]);
    const current = currentRows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return false;
    }
    // Restore stock
    await client.query('UPDATE items SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [
      Number(current.dose_quantity),
      current.item_id,
    ]);
    await client.query('DELETE FROM applications WHERE id = $1', [id]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  // Items
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  // Applications
  listApplications,
  getApplication,
  createApplicationWithStock,
  updateApplicationWithStock,
  deleteApplicationWithStock,
  // Export pool for migrations
  _pool: pool,
};

