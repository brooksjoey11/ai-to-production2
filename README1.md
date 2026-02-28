# AI to Production

A code security and quality improvement platform powered by a three-step LLM pipeline. Submit code for forensic analysis, automated repair, and quality verification — all controlled through a comprehensive runtime admin dashboard with multi‑provider API support, audit logging, and production‑grade operations tooling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19)                     │
│  Brutalist UI · IBM Plex Fonts · Tailwind 4 · tRPC Client  │
└─────────────────────┬───────────────────────────────────────┘
                      │ tRPC (superjson)
┌─────────────────────▼───────────────────────────────────────┐
│                   BACKEND (Express + tRPC 11)                │
│  Auth · Rate Limiter · Config Service · Job Queue · Metrics  │
└──────┬──────────┬──────────┬──────────┬─────────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼───┐ ┌───▼────────┐
  │ MySQL  │ │ Redis  │ │  LLM  │ │ BullMQ     │
  │ (TiDB) │ │ Cache  │ │  API  │ │ Job Queue  │
  └────────┘ └────────┘ └───────┘ └────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Three‑Step LLM Pipeline** | Forensic analysis → Code rebuilder → Quality checker |
| **Multi‑Provider API Support** | Configure any number of LLM providers (OpenAI, Anthropic, OpenRouter, Mistral, etc.) with per‑step model selection, all managed through the admin UI |
| **Async Job Processing** | BullMQ queue with in‑memory fallback when Redis unavailable; dead‑letter queue inspection and manual retry |
| **Comprehensive Admin UI** | Runtime controls for prompts, models, API providers, operations, audit logs, metrics, system config, rate limits, users, backups, chaos experiments, canary deployments, and billing |
| **Audit Logging** | Every admin action (prompt update, model change, provider addition) is logged with before/after values, user, IP, and timestamp |
| **Observability** | Pino structured logging, Prometheus metrics, system health dashboard, per‑provider success/error rates, queue depth, token usage |
| **Rate Limiting** | Tiered rate limits (free/pro/enterprise) with admin overrides, Redis atomic counters, UTC midnight reset |
| **Data Governance** | Configurable retention policies, GDPR‑compliant user deletion, PII anonymization, automated backups |
| **Security** | Google OAuth 2.0, HTTP‑only cookies, body size limits, sanitized errors, role‑based access, encrypted API keys (AES‑256‑GCM) |
| **Reliability Tooling** | Chaos engineering experiments, canary deployments, health checks, dead‑letter queue UI |
| **Brutalist UI** | IBM Plex Sans/Mono, black/white scheme, thick borders, uppercase typography |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, tRPC React Query, wouter, date‑fns, Chart.js |
| Backend | Express 4, tRPC 11, Drizzle ORM, BullMQ, google‑auth‑library, express‑rate‑limit |
| Database | MySQL 8.0 / TiDB |
| Cache/Queue | Redis (optional, graceful fallback) |
| LLM | OpenAI‑compatible API (GPT‑4, Claude, Gemini, OpenRouter, Mistral, etc.) |
| Logging | Pino (structured JSON) |
| Metrics | prom‑client (Prometheus) |
| Auth | Google OAuth 2.0 (HTTP‑only cookie sessions, JWT) |
| Encryption | AES‑256‑GCM for API keys |

---

## Database Schema

The schema has been extended with 12 new tables to support production management features:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with role‑based access (user/admin) |
| `code_submissions` | Submitted code with language, comments, and status |
| `pipeline_results` | LLM output for each pipeline step |
| `system_prompts` | Configurable system prompts per pipeline step |
| `model_config` | LLM model selection per pipeline step (now links to `provider_models`) |
| `api_providers` | LLM provider configurations (base URL, auth type, headers) |
| `provider_api_keys` | Encrypted API keys per provider |
| `provider_models` | Available models synced from each provider |
| `provider_audit_log` | Detailed log of provider configuration changes |
| `provider_health_history` | Health check results per provider |
| `dead_letter_queue` | Failed BullMQ jobs for inspection and retry |
| `idempotency_keys` | Idempotent request tracking |
| `audit_logs` | All admin actions (prompts, models, providers, users) |
| `runtime_config` | Runtime‑reloadable configuration (canary, feature flags) |
| `user_rate_overrides` | Per‑user rate limit overrides |
| `daily_usage` | Usage tracking for billing |
| `backups` | Automated database backup records |

---

## API Endpoints

### Auth Router (Google OAuth 2.0)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | Query | Public | Returns current user or null |
| `auth.logout` | Mutation | Public | Clears session cookie |

### Code Router (unchanged)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `code.getRateLimit` | Query | Protected | Returns remaining submissions and reset time |
| `code.submit` | Mutation | Protected | Submits code, enqueues async pipeline job (supports idempotency keys) |
| `code.getJobStatus` | Query | Protected | Polls job status and retrieves results |
| `code.getHistory` | Query | Protected | Returns user's submission history |
| `code.getResult` | Query | Protected | Returns specific submission result |

### Admin Router (extended with 30+ procedures)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `admin.getPrompts` | Query | Admin | Returns all system prompts |
| `admin.updatePrompt` | Mutation | Admin | Updates prompt for a pipeline step |
| `admin.getModels` | Query | Admin | Returns model config per step (now includes provider‑model links) |
| `admin.updateModel` | Mutation | Admin | Updates model for a pipeline step |
| `admin.getSubmissions` | Query | Admin | Returns all submissions with user info |
| `admin.seedDefaults` | Mutation | Admin | Resets prompts and models to defaults |
| `admin.getAvailableModels` | Query | Admin | Returns list of available LLM models (legacy, replaced by provider‑aware endpoints) |
| `admin.getFailedJobs` | Query | Admin | Lists dead‑letter queue entries |
| `admin.retryJob` | Mutation | Admin | Retries a failed job |
| `admin.deleteDeadLetter` | Mutation | Admin | Deletes a dead‑letter entry |
| `admin.getIdempotencyKeys` | Query | Admin | Views recent idempotent requests |
| `admin.getAuditLogs` | Query | Admin | Returns filtered audit log |
| `admin.getSystemHealth` | Query | Admin | Returns health status of DB, Redis, and all providers |
| `admin.getMetrics` | Query | Admin | Returns aggregated metrics (requests, error rate, queue depth, token usage) |
| `admin.getProviders` | Query | Admin | Lists all configured API providers with their models and key status |
| `admin.addProvider` | Mutation | Admin | Adds a new LLM provider |
| `admin.updateProviderKey` | Mutation | Admin | Updates encrypted API key for a provider |
| `admin.testProviderConnection` | Mutation | Admin | Tests provider connectivity and updates health history |
| `admin.syncProviderModels` | Mutation | Admin | Fetches available models from a provider |
| `admin.toggleProvider` | Mutation | Admin | Enables/disables a provider |
| `admin.getRuntimeConfig` | Query | Admin | Lists runtime configuration keys |
| `admin.updateRuntimeConfig` | Mutation | Admin | Updates a runtime config value (audit logged) |
| `admin.getConfigHistory` | Query | Admin | Shows change history for a config key |
| `admin.getRateLimits` | Query | Admin | Returns per‑user rate limit info |
| `admin.updateUserRateLimit` | Mutation | Admin | Overrides a user's daily limit |
| `admin.getUsers` | Query | Admin | Lists users with submission counts |
| `admin.deleteUser` | Mutation | Admin | Permanently deletes a user and all associated data (GDPR) |
| `admin.exportUserData` | Mutation | Admin | Exports user data as JSON |
| `admin.getBackups` | Query | Admin | Lists database backups |
| `admin.createBackup` | Mutation | Admin | Triggers a manual backup |
| `admin.updateBackupSchedule` | Mutation | Admin | Updates backup cron schedule |
| `admin.simulateOutage` | Mutation | Admin | Starts a chaos experiment (provider outage, rate limit, slow responses) |
| `admin.getCanaryConfig` | Query | Admin | Returns current canary deployment settings |
| `admin.updateCanaryConfig` | Mutation | Admin | Updates canary traffic percentage and target model |
| `admin.getCustomers` | Query | Admin | Returns customer list for billing |
| `admin.getUsageSummary` | Query | Admin | Returns aggregated usage (tokens, spend, active users) |

---

## LLM Pipeline

The three-step pipeline processes code sequentially, now with **per‑step provider/model selection**:

### Step 1: Forensic Analysis
Performs deep inspection for bugs, security vulnerabilities, missing error handling, performance issues, and code quality problems. Outputs a structured markdown dossier.

### Step 2: Code Rebuilder
Takes the original code and forensic findings to produce a corrected version. Adds error handling, input validation, and follows language best practices. Outputs only code.

### Step 3: Quality Checker
Compares original and rebuilt code, summarizing all improvements in plain language with a confidence rating for production readiness.

Each step can use a different provider (e.g., forensic via OpenRouter, rebuilder via Mistral, quality via OpenAI) with full error classification, retries, and fallback.

---

## Configuration Layer

All pipeline behavior and system settings are configurable at runtime through the admin dashboard:

- **System Prompts**: Edit the system prompt for each pipeline step (audit logged)
- **Model Selection**: Choose any provider and model enabled in the system (cascading dropdowns)
- **API Providers**: Add, edit, test, and sync models from OpenAI, Anthropic, OpenRouter, Mistral, Groq, Together, etc.
- **Runtime Configuration**: Edit feature flags (canary percent, default model) with version history
- **Rate Limits**: Override per‑user daily limits, view tier usage
- **Backups**: Configure automatic backups, trigger manual backups
- **Chaos Experiments**: Simulate provider outages, slow responses, Redis failures (development only)
- **Canary Deployments**: Route a percentage of traffic to test new models
- **Billing**: View customer usage, invoices, and pricing tiers (placeholder)

Caching: Redis‑backed with 5‑minute TTL, immediate invalidation on admin updates, in‑memory fallback.

---

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeSubmission.tsx    # Code input with drag-drop, language selector
│   │   │   ├── Header.tsx            # Navigation with auth state
│   │   │   ├── ResultsDisplay.tsx    # Tabbed results with copy/download/export
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── pages/
│   │   │   ├── Home.tsx              # Landing + code submission + results
│   │   │   ├── Admin.tsx             # Main admin dashboard with 14 tabs
│   │   │   ├── admin/                 # Individual admin tab components
│   │   │   │   ├── Operations.tsx
│   │   │   │   ├── AuditLog.tsx
│   │   │   │   ├── Metrics.tsx
│   │   │   │   ├── Providers.tsx
│   │   │   │   ├── SystemConfig.tsx
│   │   │   │   ├── RateLimits.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   ├── Backups.tsx
│   │   │   │   ├── Chaos.tsx
│   │   │   │   ├── Canary.tsx
│   │   │   │   └── Billing.tsx
│   │   │   └── NotFound.tsx          # 404 page
│   │   ├── App.tsx                   # Routes and layout
│   │   └── index.css                 # Brutalist theme
│   └── index.html                    # IBM Plex font loading
├── server/
│   ├── routers.ts                    # tRPC procedures (auth, code, admin – extended)
│   ├── pipeline.ts                   # Three-step LLM pipeline (provider‑aware)
│   ├── configService.ts              # Runtime config with Redis caching + provider resolution
│   ├── providerService.ts            # Provider config retrieval with decryption
│   ├── encryption.ts                 # AES‑256‑GCM key encryption
│   ├── rateLimit.ts                  # Redis atomic rate limiting with tier support
│   ├── jobQueue.ts                   # BullMQ async job processing + dead‑letter queue
│   ├── redis.ts                      # Redis connection with fallback
│   ├── logger.ts                     # Pino structured logger
│   ├── metrics.ts                    # Prometheus counters/histograms
│   ├── middleware.ts                 # Request logging and metrics
│   ├── health.ts                     # Health check endpoint (deepened)
│   ├── audit.ts                      # Audit logging middleware
│   ├── seed.ts                       # Default prompts and model config
│   ├── db.ts                         # Database query helpers (extended imports)
│   ├── features.test.ts              # 39 integration/unit tests
│   └── _core/                        # Framework plumbing (Google OAuth, cookies, etc.)
├── drizzle/
│   ├── schema.ts                     # 18‑table MySQL schema with indexes
│   └── 0003_add_admin_features.sql   # Migration for all new tables
├── shared/
│   ├── config.ts                     # Externalized configuration
│   └── const.ts                      # Shared constants
└── package.json

```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL/TiDB connection string |
| `JWT_SECRET` | Yes | Session cookie signing secret |
| `REDIS_URL` | No | Redis connection URL (defaults to `redis://localhost:6379`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL (e.g., `http://localhost:3000/api/auth/google/callback`) |
| `ENCRYPTION_KEY` | Yes (prod) | 32‑byte key for AES‑256‑GCM; must be set in production |
| `MAX_DAILY_SUBMISSIONS` | No | Rate limit per user per day (default: 5) |
| `MAX_CODE_SIZE_BYTES` | No | Maximum code submission size (default: 100000) |
| `DEFAULT_LLM_MODEL` | No | Legacy default LLM model (default: `gpt-4-turbo`) |
| `CACHE_TTL_SECONDS` | No | Config cache TTL (default: 300) |
| `JOB_MAX_RETRIES` | No | Pipeline job retry attempts (default: 3) |
| `JOB_BACKOFF_DELAY_MS` | No | Retry backoff delay (default: 5000) |
| `JOB_TIMEOUT_MS` | No | Pipeline job timeout (default: 300000) |

> **Note:** `OAUTH_SERVER_URL` and `VITE_OAUTH_PORTAL_URL` are no longer used and should be removed.

---

## Local Development

```bash
# Install dependencies
pnpm install

# Push database schema (includes new tables)
pnpm db:push

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check
```

---

## Observability Endpoints

| Endpoint         | Description                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`  | Returns DB, Redis, and all configured providers’ reachability status                                                          |
| `GET /metrics` | Prometheus‑format metrics (HTTP requests, queue size, LLM tokens, rate limit hits, provider‑specific success/error counters) |

---

## Admin Dashboard

The admin interface has been expanded to include:

| Tab                     | Functionality                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Prompts**       | Edit system prompts for forensic/rebuilder/quality steps                               |
| **Models**        | Select provider and model per pipeline step                                            |
| **History**       | View recent submissions                                                                |
| **API Providers** | Manage LLM providers, API keys, test connections, sync models                          |
| **Operations**    | Dead‑letter queue with retry/delete, idempotency keys                                 |
| **Audit Log**     | Filterable log of all admin actions with before/after JSON                             |
| **Metrics**       | System health dashboard, request rates, error rates, token usage, provider performance |
| **System Config** | Runtime‑reloadable feature flags (canary percent, default model) with version history |
| **Rate Limits**   | View and override per‑user daily limits                                               |
| **Users**         | List users, export data, delete users (GDPR)                                           |
| **Backups**       | Schedule and create database backups                                                   |
| **Chaos**         | Simulate provider outages, slow responses, Redis failures (development only)           |
| **Canary**        | Route a percentage of traffic to test new models                                       |
| **Billing**       | Customer list, invoices, pricing tiers (placeholder)                                   |

All changes are audit‑logged and, where applicable, cached in Redis with immediate invalidation.

---

## Authentication Setup (Google OAuth 2.0)

1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://yourdomain.com/api/auth/google/callback`
3. Add the following to your `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
4. Users click "Sign In" and are redirected to Google; after consent they are returned with a session cookie.

---

## Admin Setup

1. Sign in via Google OAuth (default role: `user`)
2. Promote to admin via database:
   ```sql
   UPDATE users SET role='admin' WHERE email='your-email';
   ```
3. Access admin dashboard at `/admin`
4. Configure API providers, sync models, set up pipeline steps, and adjust system settings as needed.

---

## Testing

39+ tests covering core functionality and the new admin procedures:

```bash
pnpm test
```

---

## Available LLM Models

Models are dynamically synced from configured providers. Supported providers include:

- OpenAI (gpt-4, gpt-4o, gpt-4o-mini, etc.)
- Anthropic (claude-3-5-sonnet, claude-3-haiku)
- Google (gemini-1.5-pro, gemini-1.5-flash, gemini-2.5-flash)
- OpenRouter (meta-llama/llama-3.3-70b-instruct, mistralai/mistral-large, etc.)
- Mistral (mistral-large-latest, mistral-medium)
- Groq, Together, and any OpenAI‑compatible provider

---

## License

MIT
