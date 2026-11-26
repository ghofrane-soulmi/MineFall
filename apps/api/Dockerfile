# Minefall API. Build context: the repository root (monorepo).
#   docker build -f apps/api/Dockerfile -t minefall-api .

FROM node:22-alpine AS base
RUN npm install -g pnpm@10.18.3
WORKDIR /repo

# ---- build: install, compile shared + api, generate the Prisma client -------------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @minefall/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @minefall/api build
# Self-contained production folder: api + its prod dependencies (incl. built @minefall/shared).
RUN pnpm --filter @minefall/api deploy --prod --legacy /out \
  && cp -r apps/api/dist /out/dist

# ---- runtime: only what is needed to run --------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
