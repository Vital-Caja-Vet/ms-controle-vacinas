ms-controle-vacinas
===================

Microsserviço para controle de vacinas/medicamentos e aplicações em animais, desenvolvido em Node.js/Express e PostgreSQL (Sequelize). Segue o padrão arquitetural do serviço Python/Flask equivalente.

Requisitos
----------
- Node.js 18+
- PostgreSQL 13+

Instalação
----------
- Copie `.env.example` para `.env` e ajuste as variáveis (principalmente `DATABASE_URL`).
- Instale dependências:
  - `npm install`
- Inicie em desenvolvimento:
  - `npm run dev`
- Inicie em produção:
  - `npm start`

Configuração (.env)
-------------------
```
PORT=8003
NODE_ENV=development
# Ex.: postgres://usuario:senha@localhost:5432/ms_controle_vacinas
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ms_controle_vacinas
AUTH_SERVICE_URL=https://ad64f6d6ca53.ngrok-free.app/api/v1
MS_PRONTUARIO_URL=http://localhost:8001
ESTOQUE_MINIMO=5
DIAS_ALERTA_VALIDADE=30
```

Estrutura do projeto
--------------------
```
ms-controle-vacinas/
├── server.js
├── package.json
├── .env / .env.example
├── config/
│   └── database.js
├── middleware/
│   └── auth.js
├── models/
│   ├── index.js
│   ├── Vacina.js
│   └── Aplicacao.js
├── routes/
│   ├── vacinaRoutes.js
│   └── aplicacaoRoutes.js
├── utils/
│   └── responses.js
├── swagger.yml
└── README.md
```

Execução
--------
- A API sobe na porta configurada em `PORT` (padrão 8003). Na primeira execução sincroniza as tabelas via Sequelize.
- Documentação Swagger disponível em `/api/v1/docs`.
- Health check em `/api/v1/health`.

Autenticação
------------
- Todas as rotas protegidas exigem header `Authorization: Bearer {token}`.
- O token é validado via serviço externo `${AUTH_SERVICE_URL}/profile/me/`.
- Respostas 401 seguem o padrão `{ "error": "Token inválido", "code": "UNAUTHORIZED" }`.

Endpoints
---------
- Vacinas
  - GET `/api/v1/vacinas` (público, com filtros)
  - GET `/api/v1/vacinas/:id` (protegido)
  - POST `/api/v1/vacinas` (protegido)
  - PUT `/api/v1/vacinas/:id` (protegido; apenas quantidade_estoque, observacoes, valor)
  - DELETE `/api/v1/vacinas/:id` (protegido; soft delete `ativo=false`)
  - GET `/api/v1/vacinas/alertas/dashboard` (protegido)

- Aplicações
  - GET `/api/v1/aplicacoes` (protegido; filtros por animal, vacina, período, veterinário)
  - POST `/api/v1/aplicacoes` (protegido; registra e debita estoque atômico/validado)
  - GET `/api/v1/aplicacoes/:id` (protegido)
  - GET `/api/v1/aplicacoes/animal/:animal_id` (protegido)

Regras de Negócio
-----------------
- Vacinas
  - Lote único (índice único em `lote`).
  - `data_validade` não pode estar no passado.
  - `quantidade_estoque` não pode ser negativa.
  - Atualização restrita a `quantidade_estoque`, `observacoes`, `valor`.
  - Soft delete via `ativo=false`.

- Aplicações
  - Nunca aplicar produto vencido.
  - Verificar estoque suficiente e debitar automaticamente.
  - Validar existência do animal via `${MS_PRONTUARIO_URL}/api/v1/animais/{id}`; se 404 bloqueia, se falha de rede usa fallback de nome.
  - Histórico por animal, por vacina e por período via filtros/listagem.

- Alertas
  - Estoque baixo `<= ESTOQUE_MINIMO`.
  - Validade próxima `<= DIAS_ALERTA_VALIDADE` dias.
  - Produtos vencidos listados e bloqueados em aplicação.

Padrões de Resposta
-------------------
- Sucesso:
```
{
  "status": "success",
  "data": { ... },
  "message": "Operação realizada com sucesso"
}
```

- Erro de Validação:
```
{
  "error": "Descrição do erro",
  "details": "Detalhes específicos",
  "code": "VALIDATION_ERROR"
}
```

- Erro de Autenticação:
```
{
  "error": "Token inválido",
  "code": "UNAUTHORIZED"
}
```

Testes com Postman
------------------
- Coleção recomendada: `ms-controle-vacinas.postman_collection.json` com cenários:
  1. Cadastro de vacina válida
  2. Cadastro com lote duplicado (deve falhar)
  3. Aplicação normal (deve debitar estoque)
  4. Aplicação sem estoque (deve falhar)
  5. Aplicação de produto vencido (deve falhar)
  6. Verificação de alertas (estoque baixo, validade próxima)
  7. Histórico por animal

Integrações
-----------
- Autenticação: `${AUTH_SERVICE_URL}/profile/me/` via Bearer token.
- ms-prontuario-animal: `${MS_PRONTUARIO_URL}/api/v1/animais/{id}` para validar existência e buscar nome.

Logs
----
- Requisições são logadas via `morgan` no formato `dev`.
- Erros não tratados são logados no stderr com metadados básicos.

Containerização
---------------
- Projeto preparado para containerização (Dockerfile/compose podem ser adicionados conforme necessidade).

\nNota sobre MS_PRONTUARIO_URL
----------------------------
- A URL deve ser apenas a base do ms-prontuário, sem `/api/v1` no final.
- Exemplo de configuração válida:
```
MS_PRONTUARIO_URL=http://127.0.0.1:8001
```
- Dica (dev): para testes locais rápidos, defina `AUTH_BYPASS=true`.

Avisos de inicialização
-----------------------
- Ao subir o serviço, um aviso no log será impresso se:
  - `MS_PRONTUARIO_URL` terminar com `/api/v1` (corrija para usar apenas a base), ou
  - `MS_PRONTUARIO_URL` apontar para a mesma porta do próprio ms de vacinas (evite apontar para si mesmo; use a porta do ms-prontuário, ex.: `8001`).
