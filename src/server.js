const http = require('http');
const { URL } = require('url');
const config = require('./config');
const { ok, notFound, badRequest, sendJson } = require('./utils/response');
const { requireAuth, signJwt } = require('./middleware/jwt');
const items = require('./controllers/itemsController');
const apps = require('./controllers/applicationsController');
const { migrate } = require('./db/migrate');
const fs = require('fs');
const path = require('path');

function enableCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
}

function parseParams(pattern, path) {
  // pattern example: /api/items/:id
  const pParts = pattern.split('/').filter(Boolean);
  const tParts = path.split('/').filter(Boolean);
  if (pParts.length !== tParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    const p = pParts[i];
    const t = tParts[i];
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(t);
    else if (p !== t) return null;
  }
  return params;
}

function withAuth(handler) {
  return (req, res, params) => requireAuth(req, res, () => handler(req, res, params));
}

const server = http.createServer(async (req, res) => {
  enableCORS(res);
  if (req.method === 'OPTIONS') return res.end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Basic health
  if (req.method === 'GET' && pathname === '/health') {
    return ok(res, { status: 'ok', service: 'ms-controle-vacinas' });
  }

  // OpenAPI
  if (req.method === 'GET' && pathname === '/openapi.json') {
    try {
      const specPath = path.join(__dirname, '..', 'openapi.json');
      const data = fs.readFileSync(specPath, 'utf-8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(data);
    } catch (e) {
      return notFound(res, 'OpenAPI spec not found');
    }
  }
  if (req.method === 'GET' && pathname === '/docs') {
    const base = `http://${req.headers.host}`;
    const url = 'https://petstore.swagger.io/?url=' + encodeURIComponent(`${base}/openapi.json`);
    res.statusCode = 302;
    res.setHeader('Location', url);
    return res.end();
  }

  // Auth login (demo)
  if (req.method === 'POST' && pathname === '/auth/login') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        const { username, password } = raw ? JSON.parse(raw) : {};
        if (username === config.AUTH_DEMO_USER && password === config.AUTH_DEMO_PASS) {
          const token = signJwt({ sub: username, role: 'admin' });
          return sendJson(res, 200, { token });
        }
        return sendJson(res, 401, { error: 'Invalid credentials' });
      } catch (e) {
        return badRequest(res, 'Invalid JSON body');
      }
    });
    return;
  }

  // Items routes (protected)
  if (req.method === 'GET' && pathname === '/api/items') return withAuth(items.listItems)(req, res);
  if (req.method === 'POST' && pathname === '/api/items') return withAuth(items.createItem)(req, res);
  if (req.method === 'GET' && pathname === '/api/items/alerts') return withAuth(items.listAlerts)(req, res);

  let params;
  params = parseParams('/api/items/:id', pathname);
  if (params) {
    if (req.method === 'GET') return withAuth(items.getItem)(req, res, params);
    if (req.method === 'PUT') return withAuth(items.updateItem)(req, res, params);
    if (req.method === 'DELETE') return withAuth(items.deleteItem)(req, res, params);
  }

  // Applications routes (protected)
  if (req.method === 'GET' && pathname === '/api/applications') return withAuth(apps.listApplications)(req, res);
  if (req.method === 'POST' && pathname === '/api/applications') return withAuth(apps.createApplication)(req, res);
  // applications by id
  let appParams;
  appParams = parseParams('/api/applications/:id', pathname);
  if (appParams) {
    if (req.method === 'GET') return withAuth(apps.getApplication)(req, res, appParams);
    if (req.method === 'PUT') return withAuth(apps.updateApplication)(req, res, appParams);
    if (req.method === 'DELETE') return withAuth(apps.deleteApplication)(req, res, appParams);
  }

  return notFound(res);
});

// Run migrations before start
migrate()
  .then(() => {
    server.listen(config.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`ms-controle-vacinas listening on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to run migrations:', err);
    process.exit(1);
  });
