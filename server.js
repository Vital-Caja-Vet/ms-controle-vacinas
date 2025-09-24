require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { initDb } = require('./config/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({ status: 'success', data: { service: 'ms-controle-vacinas' }, message: 'Operação realizada com sucesso' });
});

const swaggerPath = path.join(__dirname, 'swagger.yml');
let swaggerDocument = {};
try {
  swaggerDocument = YAML.load(swaggerPath);
} catch (e) {
  swaggerDocument = {};
}
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 8003;
initDb()
  .then(() => {
    const vacinaRoutes = require('./routes/vacinaRoutes');
    const aplicacaoRoutes = require('./routes/aplicacaoRoutes');
    app.use('/api/v1/vacinas', vacinaRoutes);
    app.use('/api/v1/aplicacoes', aplicacaoRoutes);

    app.use((req, res) => {
      return res.status(404).json({ error: 'Recurso não encontrado', code: 'NOT_FOUND' });
    });

    app.use((err, req, res, next) => {
      console.error('UnhandledError', { message: err.message, stack: err.stack });
      return res.status(500).json({ error: 'Erro interno do servidor', code: 'SERVER_ERROR' });
    });

    app.listen(PORT, () => {
      console.log(`ms-controle-vacinas rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao conectar no PostgreSQL', err);
    process.exit(1);
  });

module.exports = app;


