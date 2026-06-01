# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot reload)
bun run dev

# Production
bun run start

# Docker
docker compose up -d --build
docker compose logs -f
```

## Architecture

This is a minimal single-file Bun + Hono HTTP service (`src/index.ts`) that wraps nodemailer to provide a simple REST API for sending email over SMTP.

**Endpoints:**
- `GET /health` — unauthenticated health check
- `POST /send` — sends email; requires `X-API-Key` header matching `EMAIL_SERVICE_API_KEY`

**Request body for `/send`:**
- Required: `to` (string or array), `subject`, and at least one of `html` / `text`
- Optional: `cc`, `bcc`, `from` (defaults to `SMTP_FROM` env var or `SMTP_USER`)

**Auth:** `requireApiKey` middleware checks the `X-API-Key` request header against the `EMAIL_SERVICE_API_KEY` env var.

**Port:** `PORT` env var, defaults to `2525`.

## Environment Variables

All config is via `.env` (loaded automatically by Bun):

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default 587) |
| `SMTP_SECURE` | `"true"` for TLS on connect (port 465), `"false"` for STARTTLS |
| `SMTP_USER` | SMTP login username |
| `SMTP_PASS` | SMTP login password |
| `SMTP_FROM` | Default From address |
| `EMAIL_SERVICE_API_KEY` | API key callers must supply in `X-API-Key` header |
| `PORT` | HTTP listen port (default 2525) |

## Docker / Networking

The compose file attaches the service to two **external** Docker networks — `thehub_default` and `desk_desk` — which must already exist on the host before running `docker compose up`. These connect it to other services in the broader stack.
