# AI to Production

**Forensic Code Repair Platform** — A three-step LLM pipeline that detects bugs, rebuilds code, and summarizes improvements.

Submit code in any language. The platform runs it through a forensic analysis, rewrites it to fix all identified issues, and produces a plain-language quality report. Admins can swap LLM models and edit system prompts at runtime without touching code.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Three-Step LLM Pipeline](#three-step-llm-pipeline)
- [Configuration Layer](#configuration-layer)
- [Rate Limiting](#rate-limiting)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Admin Setup](#admin-setup)
- [Design System](#design-system)
- [License](#license)

---

## Features

- **Three-step LLM pipeline** — Forensic analysis, code rebuilder, quality checker run sequentially on every submission
- **Runtime admin controls** — Switch LLM models (GPT-4, Claude, Gemini) and edit system prompts per pipeline step without redeployment
- **Rate limiting** — 5 code submissions per user per day, resets at UTC midnight, enforced via database transactions
- **Role-based access** — Users submit code and view results; admins manage prompts, models, and view all submissions
- **Drag-and-drop code upload** — Paste code or drag a file into the submission area with automatic language detection
- **Tabbed results display** — Forensic dossier (markdown), rebuilt code (with copy/download), quality report (plain language)
- **Export functionality** — Copy individual results or export all three as a combined text file
- **Brutalist UI** — IBM Plex Sans/Mono fonts, strict black-and-white color scheme, thick borders, uppercase typography
- **OAuth authentication** — Session-based auth with HTTP-only cookies, no passwords stored
- **19 passing tests** — Vitest coverage for auth, rate limiting, config service, and admin RBAC

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React 19)                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Home   │  │    Admin     │  │   Results View    │  │
│  │  Page    │  │  Dashboard   │  │  (Tabbed Display) │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                   │              │
│       └───────────────┼───────────────────┘              │
│                       │ tRPC hooks                       │
└───────────────────────┼──────────────────────────────────┘
                        │
                  ┌─────┴─────┐
                  │  Express  │
                  │  + tRPC   │
                  └─────┬─────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────┴─────┐ ┌────┴────┐ ┌─────┴──────┐
    │  Pipeline  │ │  Config │ │    Rate    │
    │  Service   │ │ Service │ │   Limiter  │
    └─────┬─────┘ └────┬────┘ └─────┬──────┘
          │            │             │
          │      ┌─────┴─────┐      │
          │      │   MySQL   │      │
          │      │ (Drizzle) │──────┘
          │      └───────────┘
          │
    ┌─────┴─────┐
    │  LLM API  │
    │ (3 steps) │
    └───────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Routing | Wouter (client), tRPC 11 (API) |
| Backend | Express 4, tRPC 11, Zod validation |
| Database | MySQL (TiDB compatible), Drizzle ORM |
| Auth | OAuth with HTTP-only session cookies |
| LLM | OpenAI-compatible API (GPT-4, Claude, Gemini) |
| Testing | Vitest |
| Styling | IBM Plex Sans/Mono, brutalist design tokens |

---

## Project Structure

```
ai-to-production/
├── client/                     # Frontend application
│   ├── index.html              # Entry HTML with IBM Plex font loading
│   └── src/
│       ├── App.tsx             # Routes: /, /admin, /404
│       ├── index.css           # Brutalist design tokens & global styles
│       ├── main.tsx            # React root with tRPC + React Query providers
│       ├── const.ts            # Login URL helper
│       ├── lib/
│       │   ├── trpc.ts         # tRPC client binding
│       │   └── utils.ts        # cn() utility
│       ├── pages/
│       │   ├── Home.tsx        # Code submission + results display
│       │   ├── Admin.tsx       # Prompt editor, model config, submission history
│       │   └── NotFound.tsx    # 404 page
│       ├── components/
│       │   ├── Header.tsx      # Navigation bar with auth controls
│       │   ├── CodeSubmission.tsx   # Drag-drop upload, language picker, rate limit
│       │   ├── ResultsDisplay.tsx   # Tabbed results with copy/download/export
│       │   └── ui/             # shadcn/ui component library
│       ├── contexts/
│       │   └── ThemeContext.tsx # Theme provider (light mode default)
│       └── hooks/              # Custom React hooks
├── server/                     # Backend application
│   ├── routers.ts              # tRPC router: auth, code, admin procedures
│   ├── pipeline.ts             # Three-step LLM pipeline
│   ├── configService.ts        # Runtime prompt/model config with 5-min cache
│   ├── rateLimit.ts            # 5/day rate limiter with UTC midnight reset
│   ├── seed.ts                 # Default prompts and model configuration
│   ├── db.ts                   # Database connection and user queries
│   ├── storage.ts              # S3 file storage helpers
│   ├── _core/                  # Framework plumbing (auth, context, LLM, etc.)
│   ├── auth.logout.test.ts     # Auth logout test
│   └── features.test.ts        # Feature tests (19 test cases)
├── drizzle/                    # Database schema and migrations
│   ├── schema.ts               # 6 tables: users, code_submissions, pipeline_results,
│   │                           #   system_prompts, model_config, rate_limits
│   ├── relations.ts            # Table relationships
│   └── *.sql                   # Generated migration files
├── shared/                     # Shared types and constants
│   ├── const.ts                # Cookie name, shared constants
│   └── types.ts                # Shared TypeScript types
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
├── vitest.config.ts            # Vitest test configuration
├── drizzle.config.ts           # Drizzle ORM configuration
└── todo.md                     # Feature tracking checklist
```

---

## Database Schema

Six tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with OAuth identity, role (`user` or `admin`), timestamps |
| `code_submissions` | Submitted code with language, optional comments, linked to user |
| `pipeline_results` | LLM output for each submission: forensic dossier, rebuilt code, quality report, token usage |
| `system_prompts` | Admin-editable system prompts per pipeline step (`forensic`, `rebuilder`, `quality`) |
| `model_config` | Selected LLM model per pipeline step, changeable at runtime |
| `rate_limits` | Per-user daily submission counter with UTC midnight reset timestamp |

---

## API Endpoints

All endpoints are served via tRPC under `/api/trpc`.

### Auth Router (`auth.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | Query | Public | Returns current user or null |
| `auth.logout` | Mutation | Public | Clears session cookie |

### Code Router (`code.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `code.getRateLimit` | Query | Protected | Returns remaining submissions, total, and reset time |
| `code.submit` | Mutation | Protected | Submits code, runs pipeline, returns all three results |
| `code.getHistory` | Query | Protected | Returns user's last 20 submissions |
| `code.getResult` | Query | Protected | Returns full result for a specific submission |

### Admin Router (`admin.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `admin.getPrompts` | Query | Admin | Returns all system prompts |
| `admin.updatePrompt` | Mutation | Admin | Updates a system prompt by step name |
| `admin.getModels` | Query | Admin | Returns model config for all steps |
| `admin.updateModel` | Mutation | Admin | Changes the LLM model for a pipeline step |
| `admin.getSubmissions` | Query | Admin | Returns paginated submission history with user info |
| `admin.seedDefaults` | Mutation | Admin | Resets prompts and models to defaults |
| `admin.getAvailableModels` | Query | Admin | Returns list of supported model identifiers |

---

## Three-Step LLM Pipeline

Each submission passes through three sequential LLM calls:

### Step 1: Forensic Analysis

Produces a detailed markdown report covering critical bugs, security vulnerabilities, missing error handling, performance issues, and code quality problems. Each issue is rated by severity (CRITICAL, HIGH, MEDIUM, LOW).

### Step 2: Code Rebuilder

Takes the original code and the forensic report as input. Rewrites the code to fix every identified issue. Adds error handling, input validation, and documentation. Outputs only the corrected code with no explanations.

### Step 3: Quality Report

Compares the original and rebuilt code. Produces a plain-language summary with 3-5 bullet points describing improvements, remaining concerns, and a production-readiness confidence rating.

Each step reads its system prompt from the database via `configService.getPrompt()`, enabling admins to modify behavior without code changes.

---

## Configuration Layer

The configuration service (`server/configService.ts`) provides runtime control over the LLM pipeline:

**System Prompts** — Stored in the `system_prompts` table. Each pipeline step (`forensic`, `rebuilder`, `quality`) has its own prompt. Admins edit prompts through the dashboard; changes take effect on the next submission.

**Model Selection** — Stored in the `model_config` table. Each step can use a different model. Supported models:

- `gpt-4-turbo`
- `gpt-4o`
- `gpt-4o-mini`
- `claude-3-5-sonnet`
- `claude-3-haiku`
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-2.5-flash`

**Caching** — Model selections are cached in memory with a 5-minute TTL. Cache is invalidated immediately when an admin changes a model. Prompts are read fresh from the database on every request (no stale prompts).

**Fallback** — If the database is unavailable, hardcoded default prompts and `gpt-4-turbo` are used.

---

## Rate Limiting

- **Limit:** 5 code submissions per user per day
- **Reset:** UTC midnight (00:00:00 UTC)
- **Storage:** `rate_limits` table with per-user counter and reset timestamp
- **Enforcement:** Checked before pipeline execution; returns `TOO_MANY_REQUESTS` error with reset time
- **Display:** Frontend shows remaining submissions and countdown to reset

---

## Getting Started

### Prerequisites

- **Node.js** 22+ (LTS recommended)
- **pnpm** 10+ (package manager)
- **MySQL** 8.0+ (or TiDB-compatible database)

### Installation

```bash
# Clone the repository
git clone https://github.com/brooksjoey11/ai-to-production2.git
cd ai-to-production2

# Install dependencies
pnpm install
```

---

## Environment Variables

Create a `.env` file in the project root. The following variables are required:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string (`mysql://user:pass@host:port/database`) |
| `JWT_SECRET` | Yes | Secret for signing session cookies (min 32 characters) |
| `VITE_APP_ID` | Yes | OAuth application identifier |
| `OAUTH_SERVER_URL` | Yes | OAuth provider backend URL |
| `VITE_OAUTH_PORTAL_URL` | Yes | OAuth login portal URL (frontend redirect) |
| `OWNER_OPEN_ID` | Yes | Owner's OAuth identifier (auto-promoted to admin) |
| `OWNER_NAME` | No | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Yes | LLM API endpoint URL |
| `BUILT_IN_FORGE_API_KEY` | Yes | Bearer token for LLM API (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | No | Bearer token for frontend API access |
| `VITE_FRONTEND_FORGE_API_URL` | No | LLM API URL for frontend |
| `NODE_ENV` | No | `development` or `production` (defaults to development) |

Example `.env`:

```bash
DATABASE_URL=mysql://root:password@localhost:3306/ai_to_production
JWT_SECRET=your-secret-key-at-least-32-characters-long
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://your-oauth-provider.com
VITE_OAUTH_PORTAL_URL=https://your-oauth-provider.com/login
OWNER_OPEN_ID=your-owner-open-id
BUILT_IN_FORGE_API_URL=https://your-llm-api.com
BUILT_IN_FORGE_API_KEY=your-llm-api-key
```

---

## Running Locally

### 1. Set up the database

```bash
# Create the MySQL database
mysql -u root -p -e "CREATE DATABASE ai_to_production;"

# Run migrations (generates SQL and applies it)
pnpm db:push
```

### 2. Start the development server

```bash
pnpm dev
```

The server starts at `http://localhost:3000` with hot module replacement for both client and server code.

### 3. Seed default configuration (optional)

After logging in as admin, click "SEED DEFAULTS" in the admin dashboard, or the defaults will be used automatically on first submission.

### 4. Build for production

```bash
# Type-check
pnpm check

# Build client (Vite) and server (esbuild)
pnpm build

# Start production server
pnpm start
```

---

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm vitest
```

The test suite includes 19 test cases covering:

- Auth logout (cookie clearing)
- Rate limit info retrieval
- Rate limit consumption and enforcement
- Rate limit reset after expiry
- Config service prompt retrieval and updates
- Config service model retrieval and updates
- Model cache invalidation
- Admin procedure RBAC (forbidden for non-admin users)
- Pipeline input/output structure validation
- Code extraction from markdown responses

---

## Admin Setup

### Promoting a user to admin

The project owner (identified by `OWNER_OPEN_ID`) is automatically promoted to admin on first login. To promote additional users:

```sql
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

### Admin dashboard features

Navigate to `/admin` (visible only to admin users):

1. **System Prompts** — Edit the system prompt for each pipeline step (forensic, rebuilder, quality). Changes take effect immediately on the next submission.

2. **Model Config** — Select the LLM model for each pipeline step from a dropdown of supported models. Changes propagate within 5 minutes (or immediately after cache invalidation).

3. **Submissions** — View a table of all user submissions with user name, email, language, and timestamp.

4. **Seed Defaults** — Reset all prompts and models to their default values.

---

## Design System

The UI follows a **brutalist design aesthetic**:

| Element | Specification |
|---------|--------------|
| Primary font | IBM Plex Sans (headings, body) |
| Monospace font | IBM Plex Mono (code, labels) |
| Color scheme | Strict black (`#000`) and white (`#fff`) |
| Borders | 3px solid black on all interactive elements |
| Typography | Uppercase for headings and labels |
| Buttons | Black background, white text, no border-radius |
| Inputs | White background, thick black border, monospace font |
| Tabs | Thick bottom border for active state |
| Shadows | None (flat design) |
| Hover states | Color inversion (white on black becomes black on white) |

---

## License

MIT
