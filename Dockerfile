FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copia apenas o necess�rio (sem data/; ser� volume)
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY openapi.json ./openapi.json

EXPOSE 3003
ENV PORT=3003

CMD ["node", "src/server.js"]