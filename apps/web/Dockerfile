# Minefall web client: static build served by Nginx, which also proxies the API.
# Build context: the repository root.  docker build -f apps/web/Dockerfile -t minefall-web .

FROM node:22-alpine AS build
RUN npm install -g pnpm@10.18.3
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @minefall/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @minefall/web build

FROM nginx:1.29-alpine AS runtime
COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
