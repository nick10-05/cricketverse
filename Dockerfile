# Build the client, then run the game server (which also serves the client).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/game ./src/game
COPY src/net/protocol.ts ./src/net/protocol.ts
EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://localhost:3001/healthz || exit 1
CMD ["npx", "tsx", "server/index.ts"]
