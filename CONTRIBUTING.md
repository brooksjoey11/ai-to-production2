# Contributing

## Development Workflow

1. **Schema changes** — Edit `drizzle/schema.ts`, then run `pnpm db:push` to generate and apply migrations.
2. **Database helpers** — Add query functions in `server/db.ts` (return raw Drizzle rows).
3. **API procedures** — Add or extend tRPC procedures in `server/routers.ts`. Use `protectedProcedure` for authenticated routes and `adminProcedure` for admin-only routes.
4. **Frontend pages** — Create components under `client/src/pages/` and register routes in `client/src/App.tsx`. Use `trpc.*.useQuery` and `trpc.*.useMutation` for data fetching.
5. **Tests** — Write Vitest specs in `server/*.test.ts` and run `pnpm test`.

## Code Style

- TypeScript strict mode
- Prettier for formatting (`pnpm format`)
- Tailwind CSS utilities for styling
- shadcn/ui components for UI elements

## Branching

- `main` — Production-ready code
- Feature branches — `feature/description` for new work
- Bug fixes — `fix/description` for corrections

## Commit Messages

Follow conventional commits:

```
feat: add submission history page
fix: rate limit reset at UTC midnight
docs: update README with API endpoints
test: add config service cache tests
```
