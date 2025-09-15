function sendSuccess(res, data = {}, message = 'Operação realizada com sucesso', status = 200) {
  return res.status(status).json({ status: 'success', data, message });
}

function sendValidationError(res, error = 'Dados inválidos', details = null, code = 'VALIDATION_ERROR', status = 400) {
  const body = { error, code };
  if (details) body.details = details;
  return res.status(status).json(body);
}

function sendUnauthorized(res, error = 'Token inválido', code = 'UNAUTHORIZED', status = 401) {
  return res.status(status).json({ error, code });
}

function sendNotFound(res, error = 'Recurso não encontrado', code = 'NOT_FOUND', status = 404) {
  return res.status(status).json({ error, code });
}

function sendServerError(res, error = 'Erro interno do servidor', code = 'SERVER_ERROR', status = 500) {
  return res.status(status).json({ error, code });
}

module.exports = {
  sendSuccess,
  sendValidationError,
  sendUnauthorized,
  sendNotFound,
  sendServerError
};

