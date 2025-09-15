module.exports = (sequelize, DataTypes) => {
  const Aplicacao = sequelize.define(
    'Aplicacao',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      animal_id: { type: DataTypes.STRING, allowNull: false },
      animal_nome: { type: DataTypes.STRING },
      vacina_id: { type: DataTypes.INTEGER, allowNull: false },
      veterinario: { type: DataTypes.STRING, allowNull: false },
      quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false, validate: { min: 0.0000001 } },
      data_aplicacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      local: { type: DataTypes.STRING },
      usuario_id: { type: DataTypes.STRING },
      observacoes: { type: DataTypes.TEXT }
    },
    { tableName: 'aplicacoes', timestamps: true }
  );
  return Aplicacao;
};

