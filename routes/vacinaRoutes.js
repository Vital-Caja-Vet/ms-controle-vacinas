const express = require('express');
const moment = require('moment');
const { Op } = require('sequelize');
const { getModels } = require('../models');
const { authRequired } = require('../middleware/auth');
const { sendSuccess, sendValidationError, sendNotFound, sendServerError } = require('../utils/responses');

const router = express.Router();

const ESTOQUE_MINIMO = Number(process.env.ESTOQUE_MINIMO || 5);
const DIAS_ALERTA_VALIDADE = Number(process.env.DIAS_ALERTA_VALIDADE || 30);

// Listar vacinas (público) com filtros
router.get('/', async (req, res) => {
  try {
    const {
      tipo,
      q,
      status_validade, // vencidos | validade_proxima | validos
      estoque_baixo, // true
      ativo
    } = req.query;

    const { Vacina } = getModels();
    const filter = { where: {}, order: [['nome', 'ASC']] };

    // Por padrão, retorna apenas ativos
    if (typeof ativo === 'undefined') {
      filter.where.ativo = true;
    } else if (ativo === 'true' || ativo === true) {
      filter.where.ativo = true;
    } else if (ativo === 'false' || ativo === false) {
      filter.where.ativo = false;
    }

    if (tipo) filter.where.tipo = tipo;

    if (q) {
      const r = `%${String(q).trim()}%`;
      filter.where[Op.or] = [
        { nome: { [Op.iLike]: r } },
        { fabricante: { [Op.iLike]: r } },
        { lote: { [Op.iLike]: r } }
      ];
    }

    const now = moment().startOf('day').toDate();
    const alertaLimite = moment().add(DIAS_ALERTA_VALIDADE, 'days').endOf('day').toDate();

    if (status_validade === 'vencidos') {
      filter.where.data_validade = { [Op.lt]: now };
    } else if (status_validade === 'validade_proxima') {
      filter.where.data_validade = { [Op.gte]: now, [Op.lte]: alertaLimite };
    } else if (status_validade === 'validos') {
      filter.where.data_validade = { [Op.gte]: now };
    }

    if (String(estoque_baixo).toLowerCase() === 'true') {
      filter.where.quantidade_estoque = { [Op.lte]: ESTOQUE_MINIMO };
    }

    const items = await Vacina.findAll(filter);
    return sendSuccess(res, items);
  } catch (err) {
    console.error('VacinaListError', err);
    return sendServerError(res);
  }
});

// Dashboard de alertas (protegido)
router.get('/alertas/dashboard', authRequired, async (_req, res) => {
  try {
    const { Vacina } = getModels();
    const now = moment().startOf('day').toDate();
    const alertaLimite = moment().add(DIAS_ALERTA_VALIDADE, 'days').endOf('day').toDate();

    const [estoqueBaixo, validadeProxima, vencidos] = await Promise.all([
      Vacina.findAll({ where: { ativo: true, quantidade_estoque: { [Op.lte]: ESTOQUE_MINIMO } }, order: [['quantidade_estoque', 'ASC']] }),
      Vacina.findAll({ where: { ativo: true, data_validade: { [Op.gte]: now, [Op.lte]: alertaLimite } }, order: [['data_validade', 'ASC']] }),
      Vacina.findAll({ where: { ativo: true, data_validade: { [Op.lt]: now } }, order: [['data_validade', 'ASC']] })
    ]);

    return sendSuccess(res, {
      parametros: { ESTOQUE_MINIMO, DIAS_ALERTA_VALIDADE },
      estoque_baixo: estoqueBaixo,
      validade_proxima: validadeProxima,
      vencidos
    });
  } catch (err) {
    console.error('VacinaDashboardError', err);
    return sendServerError(res);
  }
});

// Buscar por ID (protegido)
router.get('/:id', authRequired, async (req, res) => {
  try {
    const { Vacina } = getModels();
    const item = await Vacina.findByPk(req.params.id);
    if (!item) return sendNotFound(res);
    return sendSuccess(res, item);
  } catch (err) {
    console.error('VacinaGetError', err);
    return sendServerError(res);
  }
});

// Cadastrar (protegido)
router.post('/', authRequired, async (req, res) => {
  try {
    const {
      nome,
      fabricante,
      lote,
      data_validade,
      quantidade_estoque,
      tipo,
      unidade,
      valor,
      observacoes
    } = req.body || {};

    if (!nome || !fabricante || !lote || !data_validade) {
      return sendValidationError(res, 'Campos obrigatórios ausentes', 'nome, fabricante, lote, data_validade');
    }

    const validadeDate = new Date(data_validade);
    if (isNaN(validadeDate.getTime())) {
      return sendValidationError(res, 'Data de validade inválida');
    }

    if (quantidade_estoque != null && Number(quantidade_estoque) < 0) {
      return sendValidationError(res, 'Quantidade não pode ser negativa');
    }

    try {
      const { Vacina } = getModels();
      const doc = await Vacina.create({
        nome,
        fabricante,
        lote,
        data_validade: moment(validadeDate).format('YYYY-MM-DD'),
        quantidade_estoque: Number(quantidade_estoque || 0),
        tipo,
        unidade,
        valor,
        observacoes
      });
      return sendSuccess(res, doc, 'Operação realizada com sucesso', 201);
    } catch (err) {
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        return sendValidationError(res, 'Lote já cadastrado', 'lote duplicado');
      }
      throw err;
    }
  } catch (err) {
    console.error('VacinaCreateError', err);
    return sendServerError(res);
  }
});

// Atualizar (protegido) - apenas campos seguros
router.put('/:id', authRequired, async (req, res) => {
  try {
    const allow = ['quantidade_estoque', 'observacoes', 'valor'];
    const payload = {};
    for (const k of allow) {
      if (k in req.body) payload[k] = req.body[k];
    }

    if ('quantidade_estoque' in payload && Number(payload.quantidade_estoque) < 0) {
      return sendValidationError(res, 'Quantidade não pode ser negativa');
    }

    const { Vacina } = getModels();
    await Vacina.update(payload, { where: { id: req.params.id } });
    const doc = await Vacina.findByPk(req.params.id);
    if (!doc) return sendNotFound(res);
    return sendSuccess(res, doc);
  } catch (err) {
    console.error('VacinaUpdateError', err);
    return sendServerError(res);
  }
});

// Inativar (soft delete) - protegido
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const { Vacina } = getModels();
    await Vacina.update({ ativo: false }, { where: { id: req.params.id } });
    const doc = await Vacina.findByPk(req.params.id);
    if (!doc) return sendNotFound(res);
    return sendSuccess(res, doc, 'Vacina inativada com sucesso');
  } catch (err) {
    console.error('VacinaDeleteError', err);
    return sendServerError(res);
  }
});

// moved above

module.exports = router;
