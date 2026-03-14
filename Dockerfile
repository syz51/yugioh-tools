# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.3.9

FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=bun:bun /app/.output ./.output

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e 'const url = "http://127.0.0.1:" + (process.env.PORT ?? "3000") + "/"; const res = await fetch(url); if (!res.ok) throw new Error("Healthcheck failed with " + res.status)'

CMD ["bun", ".output/server/index.mjs"]
