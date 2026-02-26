# AI to Production

A code security and quality improvement platform powered by a three-step LLM pipeline. Submit code for forensic analysis, automated repair, and quality verification — all controlled through a runtime admin dashboard.

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
| **Three-Step LLM Pipeline** | Forensic analysis → Code rebuilder → Quality checker |
| **Async Job Processing** | BullMQ queue with in-memory fallback when Redis unavailable |
| **Runtime Admin Controls** | Modify system prompts and switch LLM models per step without code changes |
| **Rate Limiting** | 5 submissions/user/day, Redis atomic counters with DB fallback, UTC midnight reset |
| **Observability** | Pino structured logging, Prometheus metrics, `/health` and `/metrics` endpoints |
| **Security** | HTTP-only cookies, body size limits, sanitized errors, role-based access |
| **Brutalist UI** | IBM Plex Sans/Mono, black/white scheme, thick borders, uppercase typography |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, tRPC React Query, wouter |
| Backend | Express 4, tRPC 11, Drizzle ORM, BullMQ |
| Database | MySQL 8.0 / TiDB |
| Cache/Queue | Redis (optional, graceful fallback) |
| LLM | OpenAI-compatible API (GPT-4, Claude, Gemini) |
| Logging | Pino (structured JSON) |
| Metrics | prom-client (Prometheus) |
| Auth | Manus OAuth (HTTP-only cookie sessions) |

---

## Database Schema

Six tables power the application:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with role-based access (user/admin) |
| `code_submissions` | Submitted code with language, comments, and status |
| `pipeline_results` | LLM output for each pipeline step |
| `system_prompts` | Configurable system prompts per pipeline step |
| `model_config` | LLM model selection per pipeline step |
| `rate_limits` | Legacy rate limit tracking (Redis primary) |

---

## API Endpoints

### Auth Router

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | Query | Public | Returns current user or null |
| `auth.logout` | Mutation | Public | Clears session cookie |

### Code Router

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `code.getRateLimit` | Query | Protected | Returns remaining submissions and reset time |
| `code.submit` | Mutation | Protected | Submits code, enqueues async pipeline job |
| `code.getJobStatus` | Query | Protected | Polls job status and retrieves results |
| `code.getHistory` | Query | Protected | Returns user's submission history |
| `code.getResult` | Query | Protected | Returns specific submission result |

### Admin Router

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `admin.getPrompts` | Query | Admin | Returns all system prompts |
| `admin.updatePrompt` | Mutation | Admin | Updates prompt for a pipeline step |
| `admin.getModels` | Query | Admin | Returns model config per step |
| `admin.updateModel` | Mutation | Admin | Updates model for a pipeline step |
| `admin.getSubmissions` | Query | Admin | Returns all submissions with user info |
| `admin.seedDefaults` | Mutation | Admin | Resets prompts and models to defaults |
| `admin.getAvailableModels` | Query | Admin | Returns list of available LLM models |

---

## LLM Pipeline

The three-step pipeline processes code sequentially:

### Step 1: Forensic Analysis
Performs deep inspection for bugs, security vulnerabilities, missing error handling, performance issues, and code quality problems. Outputs a structured markdown dossier.

### Step 2: Code Rebuilder
Takes the original code and forensic findings to produce a corrected version. Adds error handling, input validation, and follows language best practices. Outputs only code.

### Step 3: Quality Checker
Compares original and rebuilt code, summarizing all improvements in plain language with a confidence rating for production readiness.

---

## Configuration Layer

All pipeline behavior is configurable at runtime through the admin dashboard:

- **System Prompts**: Edit the system prompt for each pipeline step
- **Model Selection**: Choose from GPT-4-turbo, GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Claude 3 Haiku, Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.5 Flash
- **Caching**: Redis-backed with 5-minute TTL, immediate invalidation on admin updates
- **Fallback**: In-memory cache when Redis is unavailable

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
│   │   │   ├── Admin.tsx             # Prompt editor, model config, history
│   │   │   └── NotFound.tsx          # 404 page
│   │   ├── App.tsx                   # Routes and layout
│   │   └── index.css                 # Brutalist theme
│   └── index.html                    # IBM Plex font loading
├── server/
│   ├── routers.ts                    # tRPC procedures (auth, code, admin)
│   ├── pipeline.ts                   # Three-step LLM pipeline
│   ├── configService.ts              # Runtime config with Redis caching
│   ├── rateLimit.ts                  # Redis atomic rate limiting
│   ├── jobQueue.ts                   # BullMQ async job processing
│   ├── redis.ts                      # Redis connection with fallback
│   ├── logger.ts                     # Pino structured logger
│   ├── metrics.ts                    # Prometheus counters/histograms
│   ├── middleware.ts                 # Request logging and metrics
│   ├── health.ts                     # Health check endpoint
│   ├── seed.ts                       # Default prompts and model config
│   ├── db.ts                         # Database query helpers
│   ├── features.test.ts              # 38 integration/unit tests
│   └── _core/                        # Framework plumbing (auth, OAuth, etc.)
├── drizzle/
│   └── schema.ts                     # 6-table MySQL schema with indexes
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
| `MAX_DAILY_SUBMISSIONS` | No | Rate limit per user per day (default: 5) |
| `MAX_CODE_SIZE_BYTES` | No | Maximum code submission size (default: 100000) |
| `DEFAULT_LLM_MODEL` | No | Default LLM model (default: `gpt-4-turbo`) |
| `CACHE_TTL_SECONDS` | No | Config cache TTL (default: 300) |
| `JOB_MAX_RETRIES` | No | Pipeline job retry attempts (default: 3) |
| `JOB_BACKOFF_DELAY_MS` | No | Retry backoff delay (default: 5000) |
| `JOB_TIMEOUT_MS` | No | Pipeline job timeout (default: 300000) |

---

## Local Development

```bash
# Install dependencies
pnpm install

# Push database schema
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

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Returns DB, Redis, and LLM reachability status |
| `GET /metrics` | Prometheus-format metrics (HTTP requests, queue size, LLM tokens, rate limit hits) |

---

## Admin Setup

1. Register via OAuth (default role: `user`)
2. Promote to admin via database: `UPDATE users SET role='admin' WHERE email='your-email';`
3. Access admin dashboard at `/admin`
4. Configure system prompts and LLM models per pipeline step
5. Use "Seed Defaults" to reset to factory configuration

---

## Testing

39 tests covering:
- Auth procedures (login, logout, session management)
- Rate limiting (consumption, daily limits, reset behavior)
- Config service (prompts, models, caching, invalidation)
- Admin access control (role-based rejection)
- Job queue (status tracking, in-memory fallback)
- Metrics and logging (Prometheus output, Pino instance)
- Shared configuration (validation, defaults)

```bash
pnpm test
```

---

## Available LLM Models

| Model | Provider |
|-------|----------|
| gpt-4-turbo | OpenAI |
| gpt-4o | OpenAI |
| gpt-4o-mini | OpenAI |
| claude-3-5-sonnet | Anthropic |
| claude-3-haiku | Anthropic |
| gemini-1.5-pro | Google |
| gemini-1.5-flash | Google |
| gemini-2.5-flash | Google |

---

## License

MIT
