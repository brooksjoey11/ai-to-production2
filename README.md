# AI to Production

A full-stack web application that lets authenticated users submit source code and receive outputs from a three-step LLM pipeline:

1. **Forensic**: produces a structured forensic dossier  
2. **Rebuilder**: produces rebuilt code  
3. **Quality**: produces a plain-language quality report

The admin dashboard can edit **system prompts** and **per-step model strings** stored in the database.

---

## What This Repo Actually Includes

### Implemented
- **React SPA** frontend (Vite) with:
  - Code submission UI
  - Results UI (forensic / rebuilt code / quality report)
  - Admin page (prompts + model config + submission listing)
- **Express + tRPC** backend with:
  - OAuth callback route
  - Auth session via HTTP-only cookie (JWT)
  - Code submission API (async job)
  - Job status polling API
  - Admin APIs for prompts/models/submissions
- **Three-step pipeline** executed as a background job
- **MySQL-compatible database** via Drizzle ORM (mysql2)
- **Redis optional** (used for BullMQ queue/caching when available; falls back when unavailable)
- **Health + metrics endpoints**
  - `GET /health`
  - `GET /metrics` (Prometheus format)

### Not Implemented (despite older README wording in some forks/templates)
- Multi-provider provider registry + API-key management UI
- Audit logging tables and UI
- Billing/usage tables and UI
- Backups/chaos/canary tooling
- Dead-letter queue inspection UI
- “39 tests” suite (this repo includes a small number of tests only)

---

## Architecture
