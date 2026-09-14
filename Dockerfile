# syntax=docker/dockerfile:1

# ---------- etap budowania ----------
# Bun buduje frontend (Vite) i pakuje serwer (esbuild) w jeden plik CJS.
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Najpierw manifesty — warstwa z zależnościami przetrwa zmiany w kodzie.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- etap uruchomieniowy ----------
# Serwer jest spakowany razem z express, ws i dotenv, więc obraz docelowy
# nie potrzebuje node_modules ani niczego z narzędzi deweloperskich.
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/dist ./dist

# Obraz node dostarcza nieuprzywilejowanego użytkownika `node`.
USER node

EXPOSE 3000

# Healthcheck korzysta z wbudowanego wgeta (busybox) — brak dodatkowych pakietów.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "dist/server.cjs"]
