const { DataTypes } = require('sequelize');
const defineVacina = require('./Vacina');
const defineAplicacao = require('./Aplicacao');

let models = null;

function defineModels(sequelize) {
  const Vacina = defineVacina(sequelize, DataTypes);
  const Aplicacao = defineAplicacao(sequelize, DataTypes);

  // Associations
  Vacina.hasMany(Aplicacao, { foreignKey: 'vacina_id' });
  Aplicacao.belongsTo(Vacina, { foreignKey: 'vacina_id' });

  models = { Vacina, Aplicacao };
  return models;
}

function getModels() {
  if (!models) throw new Error('Models not initialized. Call initDb() first.');
  return models;
}

module.exports = { defineModels, getModels };

