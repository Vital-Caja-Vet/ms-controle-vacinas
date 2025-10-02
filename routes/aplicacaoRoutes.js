const express = require('express');
const axios = require('axios');
const moment = require('moment');
const { Op } = require('sequelize');

const { authRequired } = require('../middleware/auth');
const { getModels } = require('../models');
const { sequelize } = require('../config/database');
const { sendSuccess, sendValidationError, sendNotFound, sendServerError } = require('../utils/responses');

const router = express.Router();

const ESTOQUE_MINIMO = Number(process.env.ESTOQUE_MINIMO || 5);
// Sanitize MS_PRONTUARIO_URL: remove trailing slash and any trailing /api/v1
const __RAW_MS_PRONTUARIO_URL = process.env.MS_PRONTUARIO_URL || 'http://localhost:8001';
const __BASE_MS_PRONTUARIO_URL = __RAW_MS_PRONTUARIO_URL.replace(/\/$/, '').replace(/\/api\/v1$/, '');
const MS_PRONTUARIO_URL = __BASE_MS_PRONTUARIO_URL;

async function getAnimalInfo(animalId, token) {
  const url = `${MS_PRONTUARIO_URL}/api/v1/animais/${encodeURIComponent(animalId)}`;
  try {
    const resp = await axios.get(url, {
      headers: { Authorization: token },
      timeout: 8000
    });
    const data = resp.data?.data || resp.data || {};
    return { exists: true, name: data.nome || data.name || null, raw: data };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn('ProntuarioAnimalNotFound', { url, MS_PRONTUARIO_URL });
      return { exists: false };
    }
    return { exists: true, name: null, raw: null, uncertain: true };
  }
}

router.get('/', authRequired, async (req, res) => {
  try {
    const { Aplicacao } = getModels();
    const { animal_id, vacina_id, veterinario, data_inicio, data_fim } = req.query;
    const filter = { where: {}, order: [['data_aplicacao', 'DESC']] };
    if (animal_id) filter.where.animal_id = animal_id;
    if (vacina_id) filter.where.vacina_id = vacina_id;
    if (veterinario) filter.where.veterinario = { [Op.iLike]: `%${String(veterinario).trim()}%` };
    if (data_inicio || data_fim) {
      filter.where.data_aplicacao = {};
      if (data_inicio) filter.where.data_aplicacao[Op.gte] = moment(data_inicio).startOf('day').toDate();
      if (data_fim) filter.where.data_aplicacao[Op.lte] = moment(data_fim).endOf('day').toDate();
    }
    const items = await Aplicacao.findAll(filter);
    return sendSuccess(res, items);
  } catch (err) {
    console.error('AplicacaoListError', err);
    return sendServerError(res);
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const { animal_id, vacina_id, veterinario, quantidade, data, local, observacoes } = req.body || {};
    if (!animal_id || !vacina_id || !veterinario || !quantidade) {
      return sendValidationError(res, 'Campos obrigatórios ausentes', 'animal_id, vacina_id, veterinario, quantidade');
    }
    if (Number(quantidade) <= 0) {
      return sendValidationError(res, 'Quantidade deve ser maior que zero');
    }

    const token = req.headers['authorization'] || req.headers['Authorization'] || '';
    const animal = await getAnimalInfo(animal_id, token);
    if (!animal.exists) {
      return sendValidationError(res, 'Animal não encontrado', `animal_id ${animal_id}`);
    }

    const now = moment().startOf('day').toDate();

    const { Vacina, Aplicacao } = getModels();

    const result = await sequelize.transaction(async (t) => {
      const vacina = await Vacina.findByPk(vacina_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!vacina) return { error: 'Vacina não encontrada' };
      if (!vacina.ativo) return { error: 'Vacina inativa' };
      if (new Date(vacina.data_validade) < now) return { error: 'Produto vencido – não é permitido aplicar' };
      if (Number(vacina.quantidade_estoque) < Number(quantidade)) return { error: 'Estoque insuficiente' };

      vacina.quantidade_estoque = Number(vacina.quantidade_estoque) - Number(quantidade);
      await vacina.save({ transaction: t });

      const aplicacao = await Aplicacao.create(
        {
          animal_id,
          animal_nome: animal.name || `Animal ID ${animal_id}`,
          vacina_id: vacina.id,
          veterinario,
          quantidade: Number(quantidade),
          data_aplicacao: data ? new Date(data) : new Date(),
          local,
          usuario_id: req.user?.id || req.user?._id || req.user?.email || undefined,
          observacoes
        },
        { transaction: t }
      );

      return { aplicacao, vacina_atualizada: vacina };
    });

    if (result.error) {
      return sendValidationError(res, result.error);
    }

    const alertaEstoqueBaixo = Number(result.vacina_atualizada.quantidade_estoque) <= ESTOQUE_MINIMO;

    return sendSuccess(res, { ...result, alertas: { estoque_baixo: alertaEstoqueBaixo } }, 'Operação realizada com sucesso', 201);
  } catch (err) {
    console.error('AplicacaoCreateError', err);
    return sendServerError(res);
  }
});

router.get('/animal/:animal_id', authRequired, async (req, res) => {
  try {
    const { Aplicacao } = getModels();
    const items = await Aplicacao.findAll({ where: { animal_id: req.params.animal_id }, order: [['data_aplicacao', 'DESC']] });
    return sendSuccess(res, items);
  } catch (err) {
    console.error('AplicacaoAnimalHistoricoError', err);
    return sendServerError(res);
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const { Aplicacao } = getModels();
    const item = await Aplicacao.findByPk(req.params.id);
    if (!item) return sendNotFound(res);
    return sendSuccess(res, item);
  } catch (err) {
    console.error('AplicacaoGetError', err);
    return sendServerError(res);
  }
});

module.exports = router;
