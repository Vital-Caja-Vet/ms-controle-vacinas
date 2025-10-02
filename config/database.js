const { Sequelize } = require('sequelize');
const { Client } = require('pg');
const { defineModels } = require('../models');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ms_controle_vacinas';

// Instância do Sequelize para a base alvo
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

function parsePgUrl(url) {
  const u = new URL(url);
  const dbName = decodeURIComponent(u.pathname || '').replace(/^\//, '');
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: dbName
  };
}

async function createDatabaseIfNotExists(url) {
  const cfg = parsePgUrl(url);
  if (!cfg.database) throw new Error('DATABASE_URL sem nome do banco');

  // Conecta ao banco administrativo padrão "postgres"
  const admin = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres'
  });

  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database]);
    if (exists.rowCount === 0) {
      // Validação simples do nome do banco para evitar problemas de injeção em identificadores
      if (!/^[A-Za-z0-9_]+$/.test(cfg.database)) {
        throw new Error(`Nome de banco inválido: ${cfg.database}`);
      }
      await admin.query(`CREATE DATABASE "${cfg.database}"`);
      console.log(`Banco de dados '${cfg.database}' criado automaticamente.`);
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

async function initDb() {
  // Tenta autenticar; se o banco não existir, cria e tenta novamente
  try {
    await sequelize.authenticate();
  } catch (err) {
    const msg = String(err && (err.message || err.original && err.original.message) || '');
    const code = (err && (err.original && err.original.code)) || (err && err.code) || '';
    const dbMissing = code === '3D000' || /does not exist/i.test(msg) || /database .* does not exist/i.test(msg);
    if (!dbMissing) throw err;

    await createDatabaseIfNotExists(DATABASE_URL);
    // Tenta novamente após criar o banco
    await sequelize.authenticate();
  }

  defineModels(sequelize);
  await sequelize.sync();
  console.log('Conectado ao PostgreSQL e modelos sincronizados');
}

module.exports = { sequelize, initDb };
