function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function notFound(res, msg = 'Not found') {
  sendJson(res, 404, { error: msg });
}

function badRequest(res, msg = 'Bad request') {
  sendJson(res, 400, { error: msg });
}

function unauthorized(res, msg = 'Unauthorized') {
  sendJson(res, 401, { error: msg });
}

function forbidden(res, msg = 'Forbidden') {
  sendJson(res, 403, { error: msg });
}

function ok(res, payload) {
  sendJson(res, 200, payload);
}

function created(res, payload) {
  sendJson(res, 201, payload);
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

module.exports = {
  sendJson,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  ok,
  created,
  noContent,
};

