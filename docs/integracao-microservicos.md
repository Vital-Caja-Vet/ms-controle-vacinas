# Guia de Integracao com Outros Microsservicos

Objetivo
--------
Este documento resume como o ms-controle-vacinas se comunica com outros microsservicos e mostra o passo a passo para adicionar novas integracoes HTTP de forma consistente.

Visao geral de comunicacao
--------------------------
- As integracoes atuais usam requisicoes HTTP REST assicronas feitas com `axios` e sempre retornam JSON.
- Os servicos externos sao referenciados por variaveis de ambiente que guardam as URLs base, permitindo trocar destinos sem alterar codigo.
- Todos os handlers Express executam dentro de `try/catch` para transformar erros externos em respostas da API, preservando a experiencia do cliente.

Variaveis de ambiente obrigatorias
----------------------------------
| Variavel | Uso | Onde aparece |
| --- | --- | --- |
| `AUTH_SERVICE_URL` | Validacao de token e perfil de usuario | `middleware/auth.js:5` |
| `MS_PRONTUARIO_URL` | Consulta de animais antes de registrar aplicacoes | `routes/aplicacaoRoutes.js:14` |
| `AUTH_BYPASS` | Habilita bypass de autenticacao durante desenvolvimento | `middleware/auth.js:8` |
| `ESTOQUE_MINIMO` / `DIAS_ALERTA_VALIDADE` | Sinalizacao de alertas compartilhados | `routes/vacinaRoutes.js:11` |

Para cada novo microsservico defina sempre uma variavel `*_URL` que contenha apenas a URL base sem barra final. Exemplo no `.env`:

```bash
MS_FINANCEIRO_URL=https://financas.local/api/v1
```

Autenticacao e propagacao de credenciais
----------------------------------------
- Tokens recebidos dos clientes sao validados contra o servico de autenticacao (`middleware/auth.js:8`).
- Depois de chamados, os dados retornados sao anexados a `req.user` para que qualquer rota possa reaproveitar informacoes de usuario (`middleware/auth.js:33`).
- Ao integrar com outros microsservicos, propague o mesmo token no cabecalho `Authorization` sempre que o recurso depender da identidade original do usuario.

Cliente HTTP padrao
-------------------
Considere criar um cliente reutilizavel por microsservico. A estrutura basica pode ser inspirada nos trechos existentes:

```js
const axios = require("axios");

async function getRecurso(url, token) {
  const resp = await axios.get(url, {
    headers: { Authorization: token },
    timeout: 8000
  });
  return resp.data?.data || resp.data;
}
```

Recomendacoes:
- Sempre configure `timeout` para evitar requisicoes penduradas.
- Remova barras duplicadas usando `replace(/\/$/, "")` ao montar URLs, garantindo consistencia (ver `routes/aplicacaoRoutes.js:14`).
- Trate respostas `404` separadamente quando o retorno devera bloquear uma operacao (ex.: animal inexistente em `routes/aplicacaoRoutes.js:35`).

Fluxos ja implementados
-----------------------
1. **Validacao de token** (`middleware/auth.js:8` e `middleware/auth.js:33`)
   - Tenta diferentes formatos de cabecalho ao chamar `${AUTH_SERVICE_URL}/profile/me/`.
   - Em caso de falha nao autorizada tenta formatos alternativos antes de negar o acesso.
2. **Validacao de animal** (`routes/aplicacaoRoutes.js:14` e `routes/aplicacaoRoutes.js:33`)
   - Busca o animal em `${MS_PRONTUARIO_URL}` antes de gravar uma aplicacao.
   - Repassa o token recebido do cliente no cabecalho `Authorization`.
   - Diferencia `404` de falhas de rede para decidir se bloqueia ou permite continuar com estado incerto.

Adicionando um novo microsservico
---------------------------------
1. **Configurar variavel de ambiente**
   - Adicione a URL base ao `.env` e ao README para que outros ambientes sigam o padrao.
2. **Criar um cliente dedicado**
   - Crie um arquivo em `utils/` ou `services/` que encapsule chamadas HTTP, incluindo serializacao e logs.
   - Reaproveite o token da requisicao original e adicione outros headers necessarios (tracing, correlation id, etc.).
3. **Consumir na rota ou middleware**
   - Importe o cliente dentro de rotas ou middlewares e controle os erros em blocos `try/catch`.
   - Converta erros externos em respostas padronizadas utilizando os helpers de `utils/responses.js`.
4. **Testar fluxo ponta-a-ponta**
   - Configure Postman/Insomnia com o novo endpoint.
   - Valide cenarios de sucesso, falha de rede, 4xx e 5xx para garantir tratamento consistente.

Boas praticas adicionais
------------------------
- Centralize constantes de caminho e mensagens para facilitar manutencao.
- Utilize logs com contexto (ex.: `console.error("ServicoFinanceiroError", err)`) como ja feito em `routes/vacinaRoutes.js:62`).
- Sempre documente os endpoints externos e formatos de payload para que a equipe saiba como reproduzir chamadas.
- Avalie circuit breakers ou filas se a comunicacao for muito frequente ou sujeita a latencia alta.

Checklist rapido
----------------
- [ ] Variavel de ambiente adicionada ao `.env` e ao README.
- [ ] Cliente HTTP com timeout, headers e tratamento de erros.
- [ ] Rotas utilizando helpers de resposta (`utils/responses.js`).
- [ ] Testes manuais ou automatizados cobrindo os caminhos principais.
