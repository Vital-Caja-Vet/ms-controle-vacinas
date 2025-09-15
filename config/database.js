const { Sequelize } = require('sequelize');
const { defineModels } = require('../models');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ms_controle_vacinas';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

async function initDb() {
  await sequelize.authenticate();
  defineModels(sequelize);
  await sequelize.sync();
  console.log('Conectado ao PostgreSQL e modelos sincronizados');
}

module.exports = { sequelize, initDb };
