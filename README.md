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

Use Node 24 and the pinned `pnpm@12.3.4`. The public and Admin workspaces call the backend API; visitor session state stores only the RFQ cart, comparison selection and last receipt. Real operation requires the configured Supabase project, reviewed migrations, an authorized Admin with MFA, approved business/legal data and a malware scanner. Build/test success does not create these prerequisites.

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for verified results and outstanding release gates. The application is not yet certified ready for production use.

For browser verification, start `pnpm dev`, then run `pnpm test:browser`. Set `PLAYWRIGHT_EXECUTABLE_PATH` if Chromium is not at `/usr/bin/chromium`. Workspace browser contracts intercept API responses; they are deliberately distinguished from live Supabase tests.

- [Real Supabase/Auth/Storage/MFA/PDF verification results (Arabic)](docs/REAL-E2E-VERIFICATION.ar.md)
- [Backend implementation, API and connection instructions (Arabic)](docs/BACKEND.ar.md)
- [Product requirements](docs/PRD.ar.md)
- [Frontend coverage](docs/FRONTEND-COMPLETENESS.ar.md)
- [Environment variable names](.env.example)
- API inventory: `GET /api/v1/openapi` (works before database configuration).

Application records and helpers live in the private `mas` PostgreSQL schema. Only allowlisted RPCs are exposed. Never expose the Supabase server secret to the browser. SQL under `tests/database` is for disposable local tests only.
