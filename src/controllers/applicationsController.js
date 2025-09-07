const db = require('../store/db');
const { ok, created, badRequest, notFound, forbidden } = require('../utils/response');

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

async function listApplications(req, res) {
  const apps = await db.listApplications();
  return ok(res, apps);
}

async function createApplication(req, res) {
  try {
    const body = await parseBody(req);
    const { animalId, itemId, doseQuantity, date } = body;
    if (!animalId || !itemId || doseQuantity == null) {
      return badRequest(res, 'Missing required fields');
    }
    const qty = Number(doseQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return badRequest(res, 'Invalid doseQuantity');

    const result = await db.createApplicationWithStock({
      animalId: String(animalId),
      itemId: String(itemId),
      doseQuantity: qty,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      userId: req.user && (req.user.sub || req.user.username || req.user.user) ? (req.user.sub || req.user.username || req.user.user) : undefined,
    });

    return created(res, result);
  } catch (e) {
    return badRequest(res, e.message || 'Invalid request');
  }
}

async function getApplication(req, res, { id }) {
  const app = await db.getApplication(id);
  if (!app) return notFound(res, 'Application not found');
  return ok(res, app);
}

async function updateApplication(req, res, { id }) {
  try {
    const body = await parseBody(req);
    const updates = {};
    if (body.animalId != null) updates.animalId = String(body.animalId);
    if (body.itemId != null) updates.itemId = String(body.itemId);
    if (body.doseQuantity != null) {
      const q = Number(body.doseQuantity);
      if (!Number.isFinite(q) || q <= 0) return badRequest(res, 'Invalid doseQuantity');
      updates.doseQuantity = q;
    }
    if (body.date != null) updates.date = new Date(body.date).toISOString();
    updates.userId = req.user && (req.user.sub || req.user.username || req.user.user) ? (req.user.sub || req.user.username || req.user.user) : undefined;

    const updated = await db.updateApplicationWithStock(id, updates);
    if (!updated) return notFound(res, 'Application not found');
    return ok(res, updated);
  } catch (e) {
    return badRequest(res, e.message || 'Invalid request');
  }
}

async function deleteApplication(req, res, { id }) {
  const okDel = await db.deleteApplicationWithStock(id);
  if (!okDel) return notFound(res, 'Application not found');
  return ok(res, { deleted: true });
}

module.exports = { listApplications, createApplication, getApplication, updateApplication, deleteApplication };
