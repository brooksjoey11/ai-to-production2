# AI to Production - Project TODO

## Database
- [x] Extend schema with code_submissions, pipeline_results, system_prompts, model_config, rate_limits tables
- [x] Push database migrations

## Backend - Core Services
- [x] Configuration service (getPrompt, getModel, updatePrompt, updateModel with caching)
- [x] LLM pipeline service (forensic analysis, code rebuilder, quality check)
- [x] Rate limiting service (5/day per user, UTC midnight reset, DB transactions)

## Backend - tRPC Routers
- [x] Code router (getRateLimit, submit)
- [x] Admin router (getPrompt, updatePrompt, getModel, updateModel, getSubmissions)
- [x] Admin procedure middleware (role-based access)

## Backend - Seed Data
- [x] Seed default system prompts (forensic, rebuilder, quality)
- [x] Seed default model config (gpt-4-turbo for all steps)

## Frontend - Global Styling
- [x] Brutalist design: IBM Plex Sans/Mono fonts, black/white scheme, thick borders
- [x] Global CSS with brutalist base styles
- [x] Light theme configuration

## Frontend - Pages & Layout
- [x] Home page with header, code submission, results display
- [x] Admin page with protected route (admin role only)
- [x] 404 Not Found page
- [x] Navigation with login/logout and admin link

## Frontend - Code Submission
- [x] Code textarea with drag-and-drop file upload
- [x] Language selector dropdown
- [x] Comments field (optional context)
- [x] Rate limit display (remaining/total with reset time)
- [x] Submit button with loading state

## Frontend - Results Display
- [x] Tabbed interface (Forensic Dossier, Rebuilt Code, Quality Report)
- [x] Forensic dossier with markdown rendering
- [x] Rebuilt code with syntax highlighting, copy, download
- [x] Quality report bullet list
- [x] Export All as TXT functionality
- [x] New Analysis button to reset

## Frontend - Admin Dashboard
- [x] Prompt editor with textarea (per pipeline step)
- [x] Model selector dropdown (per pipeline step)
- [x] Submission history table
- [x] Save buttons with loading states

## Testing
- [x] Backend vitest for pipeline, rate limiting, admin routes (39 tests passing)
- [x] Auth logout test (existing)

## Integration
- [x] End-to-end flow: login → submit code → view results
- [x] Admin flow: login as admin → edit prompts/models → verify changes

## Production Readiness - Async Pipeline
- [x] Install BullMQ and ioredis dependencies
- [x] Create Redis connection service with graceful fallback
- [x] Replace synchronous pipeline with BullMQ job queue
- [x] Modify submission endpoint to return 202 with jobId
- [x] Create code.getJobStatus(jobId) tRPC endpoint for polling
- [x] Implement retries with exponential backoff and dead-letter queue

## Production Readiness - Redis Rate Limiting & Caching
- [x] Replace DB rate limiter with Redis atomic counters
- [x] Make MAX_DAILY_SUBMISSIONS configurable via env
- [x] Cache system prompts and model config in Redis (5-min TTL)
- [x] Invalidate cache immediately on admin updates
- [x] In-memory fallback caches with Redis primary (graceful degradation)

## Production Readiness - Security Hardening
- [x] Fix cookie options: secure: true, sameSite: 'none', proxy-aware
- [x] Sanitize all error messages (no stack traces or DB details)
- [x] Enforce 100KB code limit globally + 1MB body-parser limit
- [x] CSRF protection via SameSite cookie + tRPC mutation pattern

## Production Readiness - Observability
- [x] Replace console.* with Pino structured JSON logger
- [x] Add request logging middleware (method, path, status, duration)
- [x] Expose /health endpoint checking DB, Redis, LLM reachability
- [x] Expose /metrics endpoint with Prometheus counters/histograms

## Production Readiness - Database Optimizations
- [x] Add index on code_submissions (userId, createdAt)
- [x] Verify pipeline_results.submissionId is indexed
- [x] rate_limits table deprecated (kept for backward compat, Redis primary)

## Production Readiness - Testing & Code Quality
- [x] Integration tests: submission → job completion → retrieval
- [x] Integration tests: concurrent rate limit checks
- [x] Integration tests: admin prompt/model updates + cache invalidation
- [x] Unit tests: rate limiter, config service, metrics, logger, job queue (39 tests)
- [x] Remove ComponentShowcase from production builds
- [x] Externalize all hardcoded numbers to shared/config.ts
