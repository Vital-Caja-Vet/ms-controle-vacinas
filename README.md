ms-controle-vacinas (Node.js + PostgreSQL)

Serviço REST para controle de vacinas e medicamentos com validação de token externa, PostgreSQL por microsserviço e alertas de estoque/validade.

Recursos principais:
- Estoque: nome, fabricante, lote, validade, quantidade e limite mínimo.
- Aplicações: registra aplicação em animal, debita/restaura estoque (transacional) e bloqueia itens vencidos.
- Alertas: estoque baixo e validade próxima (configurável por `ALERT_DAYS`).
- Segurança: validação do token junto ao serviço de autenticação do professor (configurável por `AUTH_VALIDATE_URL`), com fallback JWT local para desenvolvimento.
- Documentação: OpenAPI em `/openapi.json` e visualização via `/docs`.

## Documentação da API (OpenAPI)
- Especificação: o arquivo `openapi.json` no repositório descreve todos os endpoints, modelos e códigos de resposta.
- Endpoints de Docs:
  - `GET /openapi.json`: retorna a especificação OpenAPI.
  - `GET /docs`: redireciona para o Swagger UI usando o `openapi.json` deste serviço.
- Teste rápido:
  - `curl http://localhost:3003/openapi.json`
  - Abra `http://localhost:3003/docs` no navegador para testar as rotas.
- Autenticação nas chamadas: use o header `Authorization: Bearer <token>` nas rotas protegidas.
- Importar no Postman/Insomnia: importe o arquivo `openapi.json` para gerar coleções de requisições automaticamente.
- Manutenção da doc: ao alterar rotas ou modelos, atualize `openapi.json` e verifique `GET /openapi.json`.

Como executar (local)
- Pré-requisitos: Node.js 18+ e PostgreSQL acessível; ou use Docker Compose.
- Variáveis: copie `.env.example` para `.env` e ajuste (especialmente PG* e AUTH_VALIDATE_URL).
- Instalar deps: `npm install`
- Migrar e iniciar: `npm start` (migra automaticamente ao subir)

Como executar (Docker Compose)
- Pré-requisitos: Docker + Docker Compose.
- Ajuste variáveis (opcional): copie `.env.example` para `.env` e edite.
- Subir: `docker compose up --build -d`
- Serviços:
  - API: `http://localhost:${PORT:-3003}`
  - PostgreSQL interno (não exposto): `postgres:5432`

Rotas
- `POST /auth/login` (dev): autentica e retorna JWT de teste. Body: `{ "username", "password" }`.
- `GET /health` (público): status do serviço.
- `GET /openapi.json` / `GET /docs`: documentação da API.
- `GET /api/items` (protegido): lista itens de estoque.
- `POST /api/items` (protegido): cria item. Body: `{ name, manufacturer, batch, expirationDate(ISO), stockQuantity, minStockThreshold }`.
- `GET /api/items/:id` (protegido): obtém item por id.
- `PUT /api/items/:id` (protegido): atualiza campos do item.
- `DELETE /api/items/:id` (protegido): remove item.
- `GET /api/items/alerts` (protegido): lista alertas de estoque baixo e validade próxima.
- `GET /api/applications` (protegido): lista aplicações registradas.
- `POST /api/applications` (protegido): registra aplicação. Body: `{ animalId, itemId, doseQuantity, date? }`.
- `GET /api/applications/:id` (protegido): obtém aplicação por id.
- `PUT /api/applications/:id` (protegido): atualiza aplicação; ajusta estoque conforme mudanças.
- `DELETE /api/applications/:id` (protegido): remove aplicação e reverte estoque.

Configuração
- Autenticação externa: defina `AUTH_VALIDATE_URL` (ex.: `http://<host>:<port>/api/token/validate`). O microserviço envia `Authorization: Bearer <token>` para validação.
- PostgreSQL: use variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (ou `DATABASE_URL`).
- Alertas: ajuste `ALERT_DAYS`.
- Desenvolvimento: `POST /auth/login` gera um JWT local (chave: `JWT_SECRET`).

JWT
- Enviar `Authorization: Bearer <token>` em todas as rotas protegidas.

Exemplos
- Health: `curl http://localhost:3003/health`
- Login (dev): `curl -X POST http://localhost:3003/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"password"}'`
- Itens: `curl -H "Authorization: Bearer <token>" http://localhost:3003/api/items`
