# Skills Scanner

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A full-stack Cloudflare application for **AI Agent skill cataloging and safety scanning**.

## Disclaimer

This tool provides **best-effort** scanning and risk assessment. Results are **not guaranteed** to be complete or accurate. **Do not rely on it as your only basis for security-critical decisions.** Public deployments may apply **rate limits** or other abuse controls; use fairly.

**AI:** Stage 2 (worker 2) may call **Cloudflare Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) for tagging and short summaries, with **deterministic fallbacks** when AI is unavailable.

**Data:** Submitted skills are processed through the pipeline and **stored in D1** (sanitized text, tags, risk level, and related fields). Text is **hashed (SHA-256)** for deduplication. An optional **`userId`** may be stored if your client sends it.

This software is provided **as-is**; see the [Apache License 2.0](LICENSE). Hosted instances may publish additional terms ([TERMS.md](TERMS.md)) or privacy notes ([PRIVACY.md](PRIVACY.md)).

## v0 overview

Accepts skills (text or GitHub URL), sanitizes them, detects dangerous patterns (URLs, shell commands, injections), assigns tags and risk levels, and stores results.

**Core data model** (`SanitizedSkill`):

- `originalText`, `sanitizedText`
- `urls`, `shellCommands`, `injections`
- `tags` (shell-commands, access-websites, programming, malicious…)
- `riskLevel`, `tldr`

## Architecture

**Frontend** → **POST /api/skills** → **Queue1** → **Worker1** (sanitize) → **Queue2** → **Worker2** (detect patterns) → **Queue3** → **Worker3** (finalize + D1) → **D1**

## Tech stack

- **Runtime**: Cloudflare Workers + `workerd`
- **API**: Hono + Zod validation ([`backend/src/index.ts`](backend/src/index.ts))
- **Database**: D1 + Drizzle ORM ([`backend/drizzle/schema.ts`](backend/drizzle/schema.ts))
- **Async**: Cloudflare Queues (3-stage pipeline)
- **Frontend**: React 19 + Vite + TanStack Query + Tailwind
- **Testing**: Vitest + `@cloudflare/vitest-pool-workers`, Playwright E2E
- **CLI**: Wrangler 4

## API usage

```bash
POST /api/skills
{
  "content": "Expert in React with shell scripting...",
  "sourceType": "text"
}
```

Returns `jobId`. Results available via `GET /api/skills/:id`.

## Configuration notes

- **Authoritative deploy configs**: use [`backend/wrangler.jsonc`](backend/wrangler.jsonc) together with [`workers/worker1/wrangler.jsonc`](workers/worker1/wrangler.jsonc), [`workers/worker2/wrangler.jsonc`](workers/worker2/wrangler.jsonc), [`workers/worker3/wrangler.jsonc`](workers/worker3/wrangler.jsonc), and the production-only [`workers/www-redirect/wrangler.jsonc`](workers/www-redirect/wrangler.jsonc).
- **Local dev**: use [`package.json`](package.json) `wrangler:dev` to run the backend plus all queue workers together.
- **Root** [`wrangler.jsonc`](wrangler.jsonc): repo-level tooling only; do not use it as the production deployment source of truth.

## Cloudflare deployment

This repo uses a **push-based** Cloudflare deployment with GitHub Actions and Wrangler. GitHub pushes the code to Cloudflare Workers; Cloudflare does not pull this repo via Pages Git integration.

The frontend is deployed as static assets on the backend Worker, not as a separate Pages project. That keeps the SPA and the `/api/*` routes on the same origin.

Production also includes a tiny redirect Worker for `www.scanskill.dev`, which permanently redirects to `https://scanskill.dev` without forcing the main backend Worker to run first for all static asset requests.

### Branch mapping

- `staging` -> shared staging environment
- `main` -> production environment

The deploy workflow lives at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### First-time setup

1. Create two D1 databases: `skills-scanner-db` and `skills-scanner-db-staging`.
2. Replace the placeholder `database_id` values in [`backend/wrangler.jsonc`](backend/wrangler.jsonc), [`workers/worker1/wrangler.jsonc`](workers/worker1/wrangler.jsonc), and [`workers/worker3/wrangler.jsonc`](workers/worker3/wrangler.jsonc).
3. Create six queues so staging and production stay isolated:
   - Production: `skills-queue-1`, `skills-queue-2`, `skills-queue-3`
   - Staging: `skills-queue-1-staging`, `skills-queue-2-staging`, `skills-queue-3-staging`
4. Add GitHub secrets:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
5. Create GitHub environments named `staging` and `production` if you want approvals or environment-scoped secrets.
6. Optionally attach a custom domain to the backend Worker after the first successful deploy.

### Deploy flow

On every push to `staging` or `main`, GitHub Actions will:

1. Install dependencies and verify the repo with lint, typecheck, unit tests, and build steps.
2. Apply remote D1 migrations for the target environment.
3. Deploy `worker1`, `worker2`, and `worker3`.
4. Deploy the backend Worker, which also uploads the built frontend assets.
5. On production deploys, publish the `www.scanskill.dev` redirect Worker.

The backend Worker uses SPA asset handling plus `run_worker_first` for `/api/*`, so deep links still load `index.html` while API requests keep hitting Hono.

### Manual commands

Local database migrations:

```bash
npm run db:migrate --prefix backend
```

Remote database migrations:

```bash
npm run db:migrate:staging --prefix backend
npm run db:migrate:production --prefix backend
```

Manual backend deploys:

```bash
npm run deploy:staging --prefix backend
npm run deploy:production --prefix backend
```

Manual queue-worker deploys follow the same pattern:

```bash
npx wrangler deploy --config workers/worker1/wrangler.jsonc --env staging
npx wrangler deploy --config workers/worker2/wrangler.jsonc --env staging
npx wrangler deploy --config workers/worker3/wrangler.jsonc --env staging
```

Swap `staging` for `production` when deploying the production queue workers.

Manual `www` redirect deploy:

```bash
npx wrangler deploy --config workers/www-redirect/wrangler.jsonc --env production
```

## Testing strategy

**Unit / integration** (Vitest): worker helpers, sanitation, API validation (`backend/tests/`, `workers/*/tests/`).

**E2E** (Playwright): `npm run test:e2e` runs UI tests under `frontend/`.

Run:

- `npm run dev` — full stack with Turbo
- `npm run wrangler:dev` — backend + all queue workers with persistence
- `npm test` — unit tests (Turbo)
- `npm run test:e2e` — frontend E2E
- `npm run lint` / `npm run typecheck` — ESLint (frontend) and `tsc` across packages
- `npm run db:generate && npm run db:migrate` — after schema changes

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, scripts, and PR expectations. Report vulnerabilities per [SECURITY.md](SECURITY.md).

## License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).
