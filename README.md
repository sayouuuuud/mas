# M.A.S Engineering For Trade

Arabic/English B2B product catalog and quote requests. Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL/Storage.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm test:db # Docker; creates and removes its own isolated PostgreSQL container
pnpm build
```

Use Node 24 and the pinned `pnpm@12.3.4`. The UI currently remains an explicit frontend preview. The backend API and migrations are implemented separately; production connection and replacement of preview state require a configured Supabase project. No real database or accounts are created by `pnpm build` or `pnpm test`.

- [Backend implementation, API and connection instructions (Arabic)](docs/BACKEND.ar.md)
- [Product requirements](docs/PRD.ar.md)
- [Frontend coverage](docs/FRONTEND-COMPLETENESS.ar.md)
- [Environment variable names](.env.example)
- API inventory: `GET /api/v1/openapi` (works before database configuration).

Application records and helpers live in the private `mas` PostgreSQL schema. Only allowlisted RPCs are exposed. Never expose the Supabase server secret to the browser. SQL under `tests/database` is for disposable local tests only.
