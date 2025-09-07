const db = require('../store/db');
const { ok, created, badRequest, notFound } = require('../utils/response');
const config = require('../config');

function isValidISODate(s) {
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(new Date(s).toISOString());
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        const data = raw ? JSON.parse(raw) : {};
        resolve(data);
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function listItems(req, res) {
  const items = await db.listItems();
  return ok(res, items);
}

async function getItem(req, res, { id }) {
  const item = await db.getItem(id);
  if (!item) return notFound(res, 'Item not found');
  return ok(res, item);
}

async function createItem(req, res) {
  try {
    const body = await parseBody(req);
    const { name, manufacturer, batch, expirationDate, stockQuantity, minStockThreshold } = body;
    if (!name || !manufacturer || !batch || !expirationDate || stockQuantity == null) {
      return badRequest(res, 'Missing required fields');
    }
    if (!isValidISODate(expirationDate)) return badRequest(res, 'Invalid expirationDate');
    const qty = Number(stockQuantity);
    if (!Number.isFinite(qty) || qty < 0) return badRequest(res, 'Invalid stockQuantity');
    const min = minStockThreshold == null ? 0 : Number(minStockThreshold);
    if (!Number.isFinite(min) || min < 0) return badRequest(res, 'Invalid minStockThreshold');

    const item = await db.createItem({
      name,
      manufacturer,
      batch,
      expirationDate: new Date(expirationDate).toISOString(),
      stockQuantity: qty,
      minStockThreshold: min,
    });
    return created(res, item);
  } catch (e) {
    return badRequest(res, e.message || 'Invalid request');
  }
}

async function updateItem(req, res, { id }) {
  try {
    const body = await parseBody(req);
    const updates = {};
    if (body.name != null) updates.name = String(body.name);
    if (body.manufacturer != null) updates.manufacturer = String(body.manufacturer);
    if (body.batch != null) updates.batch = String(body.batch);
    if (body.expirationDate != null) {
      if (!isValidISODate(body.expirationDate)) return badRequest(res, 'Invalid expirationDate');
      updates.expirationDate = new Date(body.expirationDate).toISOString();
    }
    if (body.stockQuantity != null) {
      const qty = Number(body.stockQuantity);
      if (!Number.isFinite(qty) || qty < 0) return badRequest(res, 'Invalid stockQuantity');
      updates.stockQuantity = qty;
    }
    if (body.minStockThreshold != null) {
      const min = Number(body.minStockThreshold);
      if (!Number.isFinite(min) || min < 0) return badRequest(res, 'Invalid minStockThreshold');
      updates.minStockThreshold = min;
    }
    const updated = await db.updateItem(id, updates);
    if (!updated) return notFound(res, 'Item not found');
    return ok(res, updated);
  } catch (e) {
    return badRequest(res, e.message || 'Invalid request');
  }
}

async function deleteItem(req, res, { id }) {
  const okDel = await db.deleteItem(id);
  if (!okDel) return notFound(res, 'Item not found');
  return ok(res, { deleted: true });
}

async function listAlerts(req, res) {
  const items = await db.listItems();
  const now = new Date();
  const nearMs = (config.ALERT_DAYS || Number(process.env.ALERT_DAYS || 30)) * 24 * 60 * 60 * 1000;
  const nearDate = new Date(now.getTime() + nearMs);
  const alerts = [];
  for (const i of items) {
    const exp = new Date(i.expirationDate);
    const isLow = i.stockQuantity <= (i.minStockThreshold || 0);
    const isNearExpiry = exp <= nearDate;
    if (isLow || isNearExpiry) {
      alerts.push({
        id: i.id,
        name: i.name,
        stockQuantity: i.stockQuantity,
        minStockThreshold: i.minStockThreshold || 0,
        expirationDate: i.expirationDate,
        lowStock: isLow,
        nearExpiry: isNearExpiry,
      });
    }
  }
  return ok(res, alerts);
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  listAlerts,
};
