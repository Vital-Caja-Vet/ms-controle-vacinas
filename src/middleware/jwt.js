const crypto = require('crypto');
const { unauthorized, forbidden } = require('../utils/response');
const config = require('../config');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

function signJwt(payload, expiresInSeconds = config.JWT_EXPIRES_IN_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: nowSec, exp: nowSec + expiresInSeconds };
  const headerB64 = base64urlJson(header);
  const payloadB64 = base64urlJson(body);
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

function verifyJwt(token) {
  if (!token) throw new Error('Missing token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB64, payloadB64, signature] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  // timing-safe compare
  const ok = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) throw new Error('Invalid signature');
  const payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSec >= payload.exp) throw new Error('Token expired');
  return payload;
}

async function validateWithProfessor(token) {
  const url = process.env.AUTH_VALIDATE_URL || config.AUTH_VALIDATE_URL || '';
  if (!url) return null; // not configured
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return false; // invalid token
    try {
      const data = await resp.json();
      return data || true;
    } catch (_) {
      return true; // valid but no JSON body
    }
  } catch (_) {
    clearTimeout(t);
    // network error -> treat as invalid for strictness (or return null to fallback)
    return false;
  }
}

function requireAuth(req, res, next) {
  (async () => {
    try {
      const auth = req.headers['authorization'] || req.headers['Authorization'];
      if (!auth) return unauthorized(res, 'Missing Authorization header');
      const [scheme, token] = String(auth).split(' ');
      if (scheme !== 'Bearer' || !token) return unauthorized(res, 'Invalid Authorization header');

      // Prefer external validation if configured
      const ext = await validateWithProfessor(token);
      if (ext === false) return forbidden(res, 'Invalid token');
      if (ext) {
        req.user = typeof ext === 'object' ? ext : { token };
        return next();
      }

      // Fallback: local verification (dev)
      const payload = verifyJwt(token);
      req.user = payload;
      return next();
    } catch (err) {
      return forbidden(res, err.message || 'Invalid token');
    }
  })();
}

module.exports = { signJwt, verifyJwt, requireAuth };
