FROM oven/bun:1 AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY . .

USER appuser

EXPOSE 2525

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -f http://localhost:2525/health || exit 1

CMD ["bun", "run", "src/index.ts"]
