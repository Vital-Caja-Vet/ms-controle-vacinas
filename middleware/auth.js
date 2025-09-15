const axios = require('axios');
const { sendUnauthorized } = require('../utils/responses');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://ad64f6d6ca53.ngrok-free.app/api/v1';

async function authRequired(req, res, next) {
  try {
    // Dev bypass opcional
    const bypass = String(process.env.AUTH_BYPASS || '').toLowerCase() === 'true';
    if (bypass) {
      req.user = { id: 'dev-user', email: 'dev@example.com', roles: ['DEV_BYPASS'] };
      return next();
    }

    const rawAuth = req.headers['authorization'] || req.headers['Authorization'];
    if (!rawAuth || !rawAuth.trim()) {
      return sendUnauthorized(res, 'Token ausente ou inválido');
    }

    const baseUrl = AUTH_SERVICE_URL.replace(/\/$/, '');
    const token = rawAuth.startsWith('Bearer ')
      ? rawAuth.replace(/^Bearer\s+/i, '').trim()
      : rawAuth.trim();

    const attempts = [
      { url: `${baseUrl}/profile/me/`, header: { Authorization: `Bearer ${token}` } },
      { url: `${baseUrl}/profile/me/`, header: { Authorization: token } },
      { url: `${baseUrl}/profile/me/`, header: { Authorization: `Token ${token}` } },
      { url: `${baseUrl}/auth/validate-token/`, header: { Authorization: token } }
    ];

    for (const attempt of attempts) {
      try {
        const resp = await axios.get(attempt.url, {
          headers: attempt.header,
          timeout: 8000
        });
        // Se validou no validate-token, pode não ter payload de usuário
        req.user = resp.data?.data || resp.data || { tokenValid: true };
        return next();
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          // tenta próximo formato
          continue;
        }
        // Erro de rede: tenta próximo, mas se for o último, responde 401 genérico
        continue;
      }
    }

    return sendUnauthorized(res, 'Token inválido ou expirado');
  } catch (e) {
    return sendUnauthorized(res, 'Erro de autenticação');
  }
}

module.exports = { authRequired };
