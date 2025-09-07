const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const defaultData = {
  items: [],
  applications: [],
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class Storage {
  constructor(filePath) {
    this.filePath = filePath;
    ensureDir(filePath);
    this.data = defaultData;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content || '{}');
        // backward compat / default
        this.data.items = this.data.items || [];
        this.data.applications = this.data.applications || [];
      } else {
        this._save();
      }
    } catch (e) {
      this.data = { ...defaultData };
      this._save();
    }
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  _id() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
  }

  // Items
  listItems() {
    return this.data.items.slice();
  }

  getItem(id) {
    return this.data.items.find((i) => i.id === id) || null;
  }

  createItem(item) {
    const now = new Date().toISOString();
    const newItem = { id: this._id(), createdAt: now, updatedAt: now, ...item };
    this.data.items.push(newItem);
    this._save();
    return newItem;
  }

  updateItem(id, updates) {
    const idx = this.data.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    const updated = { ...this.data.items[idx], ...updates, id, updatedAt: now };
    this.data.items[idx] = updated;
    this._save();
    return updated;
  }

  deleteItem(id) {
    const idx = this.data.items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.data.items.splice(idx, 1);
    this._save();
    return true;
  }

  // Applications
  listApplications() {
    return this.data.applications.slice();
  }

  createApplication(application) {
    const now = new Date().toISOString();
    const newApp = { id: this._id(), createdAt: now, ...application };
    this.data.applications.push(newApp);
    this._save();
    return newApp;
  }
}

module.exports = new Storage(config.DATA_FILE);

