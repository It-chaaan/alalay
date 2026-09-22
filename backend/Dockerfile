# syntax=docker/dockerfile:1
# Build from the repository root so .dockerignore can exclude other workspaces:
# docker build -f backend/Dockerfile -t alalay-backend .
FROM node:24-bookworm-slim AS build

WORKDIR /app

# Copy manifests first so dependency installation is cached until they change.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN npm run build

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3000

# Uses the existing unauthenticated health endpoint. Runtime secrets are injected
# by the container platform and are never copied into this image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
