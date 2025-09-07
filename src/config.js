const path = require('path');

module.exports = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 3003,
  DATA_FILE: path.join(__dirname, '..', 'data', 'storage.json'),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN_SECONDS: 60 * 60, // 1 hour
  ALERT_DAYS: 30, // validade próxima em até 30 dias
  AUTH_DEMO_USER: process.env.AUTH_USER || 'admin',
  AUTH_DEMO_PASS: process.env.AUTH_PASS || 'password',
};

