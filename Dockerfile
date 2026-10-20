FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:worker

FROM node:22-bookworm-slim AS runner
ARG APP_REVISION=development
ENV APP_REVISION=$APP_REVISION
LABEL org.opencontainers.image.source="https://github.com/santidev95/observatorio-rondonia"
LABEL org.opencontainers.image.revision=$APP_REVISION
LABEL org.observatorio.worker.receitas="1"
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/dist/revenues-worker.cjs ./revenues-worker.cjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
