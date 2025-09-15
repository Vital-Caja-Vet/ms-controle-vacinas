module.exports = (sequelize, DataTypes) => {
  const Vacina = sequelize.define(
    'Vacina',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      nome: { type: DataTypes.STRING, allowNull: false },
      fabricante: { type: DataTypes.STRING, allowNull: false },
      lote: { type: DataTypes.STRING, allowNull: false, unique: true },
      data_validade: { type: DataTypes.DATEONLY, allowNull: false },
      quantidade_estoque: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
      tipo: { type: DataTypes.STRING },
      unidade: { type: DataTypes.STRING },
      valor: { type: DataTypes.DECIMAL(10, 2) },
      observacoes: { type: DataTypes.TEXT },
      ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
    },
    { tableName: 'vacinas', timestamps: true }
  );
  return Vacina;
};

