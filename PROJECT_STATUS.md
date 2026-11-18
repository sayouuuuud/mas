# M.A.S — verification status (17 November 2026)

**Not approved for production use yet.** Code, local verification, hosted database changes and real business journeys are separate milestones.

## MFA account management — 18 November 2026

- The hosted test administrator `admin@test.com` now exists and is active; production password login was verified, and MFA remains required. No credentials are stored in this report.
- `/admin/security` adds per-account disable/re-enable and new secret/QR rotation. Old keys are removed only after successful replacement verification; cancel and invalid-code paths preserve the old verified key.
- Applied migration `20261118052201_admin_mfa_preferences.sql` to MAS DB. Existing accounts retain MFA by default; live checks confirmed the active profile still requires MFA, RLS remains enabled, and only service_role can call the preference mutation RPC.
- 45 unit/contract tests, 57 SQL assertions, typecheck/build and real isolated Auth/PostgREST browser flows pass. The real user's factor was not changed. Additional lost-device instructions were removed from the login screen as requested.
- See [MFA implementation and verification](docs/MFA-MANAGEMENT.ar.md). Earlier setup notes below describe the state at their recorded step, including the initial rejected password attempt.

## Setup requested on 18 November 2026

- The requested hosted test administrator email is `admin@test.com`. Supabase rejected the supplied password because it is shorter than six characters; account creation awaits the user's replacement-password choice. No hosted account or role was created by this failed attempt.
- Arabic/English privacy and terms were written and saved as two draft content records in MAS DB. They remain unpublished: automatic approval review rejected immediate legal publication without explicit approval of the completed texts. See [reviewable Arabic texts](docs/LEGAL-POLICIES.ar.md) and [bilingual source](content/initial-legal-policies.json).
- The user will add company/catalog data. No company, unit, reference, customer or product fixtures were added to the hosted database.
- An explicit `MEDIA_SCAN_MODE=validation_only` option is prepared in this branch. Default and unknown settings retain the antivirus requirement. Validation-only mode still verifies structure/MIME/size, re-encodes images, and rejects active PDFs; it never claims an antivirus verdict.
- Real isolated browser/Storage tests passed valid PNG → WebP → ready/download with no configured scanner; a JavaScript-bearing PDF was rejected and never received a public path. Unit tests total 41; typecheck and build pass.
- Automatic approval review rejected setting validation-only mode for Vercel Production and Preview without explicit approval of that exact change. The environment variable was not created and production behavior remains unchanged.
- [Google SMTP setup instructions](docs/GOOGLE-SMTP.ar.md) target Supabase Auth, which actually sends the app's invitation/recovery messages. Vercel SMTP variables alone have no effect in this codebase.

## Source and target

- Reviewed `sayouuuuud/mas`, `main` at `6b36589d59680bc18f1cb7b9804b38a926794763`. The other remaining branch is an older design revision. No `project.zip` was supplied in this session.
- Supabase: **MAS DB**, `tzximtqmzsqirkkpxpgr`; healthy, Postgres 17.12.
- Actual connected Vercel project: `prj_L5sWDyyelpG6j9JkyISYmBnSI2mu`, team `team_cJQKNnPDrmoSc8WqV8iF47IS`. Its Git source is this repository. The project ID quoted in the earlier plan does not exist in this connected team.
- Last pre-fix production deployment: `dpl_GmQB6TcddPB2PYjruS9T27bJd5ef`, failed to build; missing `saveResource` and other exports were confirmed in its build logs.

## Confirmed faults repaired

- Missing API helpers, shared record types and request status component prevented TypeScript checking and production builds. The live-query hook also lost its generic result type.
- Public bootstrap was called by the site but absent from the controller. Content and comparison called nonexistent `/public/content` and `/public/products` routes.
- Product editors sent arrays instead of bilingual applications/benefits, noncanonical specification fields, and nulls rejected by strict schemas. Editing a product discarded variant specifications/media; these are now preserved, with variant specification controls.
- CRM screens used nonexistent `userId`, snapshot and event fields. Note writes omitted `version`; inquiry conversion sent `customName` and followed the wrong returned ID.
- Quotation editors sent an incompatible `items`/numeric-price/global-tax payload; expected a saved record outside its response envelope; omitted action status; sent null optional transition fields; and displayed integer cents as currency units. Canonical `lines`, decimal strings, per-line discounts/taxes, terms, locale and currency are preserved. Existing quotations without an expected version cannot create another draft by accident.
- Unsupported quotation note fields were removed from the form instead of reporting unsaved text as persisted. Customer decision reasons are required for both acceptance and rejection.
- Failed saves retain form inputs on version conflicts. A network failure during sign-out now reports failure instead of pretending the server session ended.
- Late failed private queries could restore customer data after sign-out; overlapping refreshes could overwrite newer results. Both races are guarded and tested.
- Job retry ignored JSON without Content-Length. Worker authentication could throw on non-ASCII credentials. Import-token comparisons now require hex signatures.
- CSV preview read names and units from a different response shape. Sitemap now reads supported environment aliases, paginates published records and updates at request time.
- PDF visual review found reversed parentheses in mixed Arabic/Latin rows. Latin runs retain their parentheses, and customer/metadata cards wrap long text.

## Local verification actually completed

| Check | Result and limits |
| --- | --- |
| `pnpm typecheck` | Passed using Node 24 and pinned pnpm 12.3.4. |
| `pnpm test` | 39 passed: 10 frontend/cache tests and 29 backend/client-contract/security tests. |
| `pnpm test:db` | 49 SQL assertions plus the concurrent submission/version/rate-limit/job-lease test passed in a disposable PostgreSQL 17 container. Supabase Auth/Storage are not simulated by this SQL test. |
| `pnpm build` | Passed. No database/account creation is part of the build. |
| Browser rendering | 30 public/admin-entry page and viewport checks at 1440 and 390 pixels, Arabic and English, without uncaught JavaScript errors or horizontal overflow. |
| Browser workspace contracts | Intercepted API: product save/reload, conflict input retention, versioned CRM note, quotation draft/issue and PDF-processing state passed. These checks prove UI/API contract compatibility; they do not prove real Auth or database writes. |
| PDF | Generated Arabic/English 45-line PDFs spanning three pages. Inspected first-page renders and checked pagination/parseability. These use test data, not approved company documents. |
| Client secrets | Service credential absent from `.next/static`; `.env.local` is ignored and restricted to the task workspace. |

Run `pnpm dev` before `pnpm test:browser`. Install the pinned Playwright Chromium with `pnpm exec playwright install chromium` when no compatible system browser exists; set `PLAYWRIGHT_EXECUTABLE_PATH` accordingly. Test artifacts stay in ignored `work/`.

## Hosted Supabase observations

- All five applied migration bodies match the corresponding repository statements (comments and whitespace normalized). Repository filenames were aligned to the actual versions: `20261116213151`, `20261116213424`, `20261116213453`, `20261116213509`, `20261116213726`. No existing DDL was re-run to fix history.
- The applied `20261117161207_production_readiness.sql` combines the previously unapplied safeguards with strict Admin/MFA enforcement at direct RPC boundaries. It neither seeds accounts nor promotes legacy roles.
- The user explicitly approved the reviewed migration after the initial automatic-review rejection. It was then applied successfully to MAS DB as version `20261117161207`. The local filename was reconciled to that returned version. Existing data was neither seeded nor deleted.
- Post-migration checks: all application tables retain RLS; anon has zero direct table reads; anon/authenticated cannot execute `mas_command`; the retry RPC exists; `/content/attributes` now has the reserved public-list contract. No Auth users or business entities were created by the migration.
- No application entities, Auth users or staff profiles existed at inspection. Health returned `ready: false`. All four buckets exist: private quarantine, public approved catalog files, private catalog files and private sales PDFs.
- From the actual local app using the hosted project: public catalog/bootstrap returned 200 and empty data, `/auth/me` returned 401, and health returned 503 `NOT_READY`. No production RFQ, customer or product test data was inserted.
- Security advisor: private tables have RLS with no direct policies/grants by design. Public/read-only and authenticated RPC SECURITY DEFINER warnings require the existing scoped grants/projection checks, not opening table access. Health advisor returned no findings. The same intentional RPC warnings remain after the applied migration; there are no newly opened table grants.

## Hosting configuration completed

- Verified Supabase URL points to the intended project; existing legacy anon/service-role variable names are supported by the app.
- Converted the Vercel service-role variable to a hidden Secret. Added independent Production and Preview `RATE_LIMIT_SECRET` and `CRON_SECRET` values. Added the verified primary production `SITE_URL=https://mas-xi.vercel.app` and set Node 24 to match local verification.
- No scanner, SMTP credentials or approved business/legal content were invented. Deployment Protection was not disabled.
- Preview deployment `dpl_94YYwtSNQea25ZX7Jvp3U1Loxkgk` built successfully from commit `ad397b76df85d490a9c8e7b5b92799d2c8610e55`; GitHub Verify application and GitGuardian checks passed. Live preview catalog/bootstrap returned 200; health correctly returned NOT_READY.
- A successful preview build is a code milestone; it is not a production-readiness certificate. Production release and live end-to-end verification remain dependent on the items below.

## Real local Supabase journey completed after merge

- Production merged PR #4 at `d362a6d25fc45c54b73cd9e3b6a411804d52e1e7`; deployment `dpl_DzdcxnHRgtuNbyUwVh1gsB4Ffqvx` is READY.
- Real isolated Auth/TOTP, PostgreSQL/PostgREST, Storage and ClamAV browser journeys now pass: upload/scan/WebP/publication → visitor RFQ/idempotency → admin note/assignment/status → quotation issue/PDF download/revision → logout/access denial. No API responses or ready/PDF states were faked.
- A development-only loopback HTTP configuration fix enables local Supabase while preserving production HTTPS. With its boundary test, 40 tests, typecheck and production build pass.
- See [the detailed real E2E report](docs/REAL-E2E-VERIFICATION.ar.md). The hosted database still has no users, profiles or entities; hosted authenticated journeys remain a release gate.

## Remaining release gates

1. Database migration applied and post-migration RPC/grant checks completed. Health remains NOT_READY until the real operational prerequisites below exist.
2. The owner's real Auth account/UUID and MFA enrollment. There is no default account, fixed password, or automatic elevation of an existing user. `bootstrap:owner` requires the confirmed owner UUID.
3. Approved SMTP, Auth Site URL and redirect configuration for `/api/v1/auth/callback`, then actual invitation/recovery/email delivery tests.
4. Approved HTTPS malware-scanning service and key. Files remain quarantined until scanning succeeds; image-based publication is blocked without it.
5. Real company settings, units, published privacy version/terms, references, approved media and product data. Existing marketing copy/contact fallbacks need business-owner review; they were not imported into the database.
6. Actual hosted Admin+MFA → upload/scan → publish → anonymous RFQ/idempotency → CRM follow-up → quotation/PDF/revision → inquiry conversion → CSV atomicity → logout/disabled-account journeys. Authenticated browser coverage awaits a real authorized account; intercepted browser tests do not replace these journeys.
7. Confirm public production-domain access, Auth redirects, operational monitoring/backups, and production health after the release gates above pass.

No claim of complete production readiness should be made while these gates are open.
