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
- [x] Backend vitest for pipeline, rate limiting, admin routes (19 tests passing)
- [x] Auth logout test (existing)

## Integration
- [x] End-to-end flow: login → submit code → view results
- [x] Admin flow: login as admin → edit prompts/models → verify changes
