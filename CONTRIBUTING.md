# Contributing

Thanks for helping improve Skills Scanner.

## Prerequisites

- Node.js 20+ (22 recommended for CI parity)
- npm 10+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 4.x (installed via devDependencies at the repo root)

## Clone and install

```bash
git clone <repository-url>
cd skill-project
npm ci
```

## Repository hygiene

- A **root [`.gitignore`](.gitignore)** excludes build artifacts, `node_modules/`, `.wrangler/`, `.turbo/`, Playwright output, env files, and **`.cursor/`** (local editor/AI settings). Do not commit those paths.
- If you are **migrating an existing clone** into a public repo, remove any already-tracked artifacts from the index, for example:
  ```bash
  git rm -r --cached frontend/dist .turbo 2>/dev/null || true
  ```
  Then commit the `.gitignore` update.

## Local development

- Full stack (Turbo): `npm run dev`
- Backend + all queue workers with persistence (recommended for pipeline testing): `npm run wrangler:dev`  
  Uses multiple Wrangler configs under [`backend/wrangler.jsonc`](backend/wrangler.jsonc) and [`workers/worker1|worker2|worker3/wrangler.jsonc`](workers/).

The root [`wrangler.jsonc`](wrangler.jsonc) is a minimal umbrella config for tooling; day-to-day API + pipeline development uses the backend and worker configs above.

## Database

After schema changes:

```bash
npm run db:generate
npm run db:migrate
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint (frontend) + `tsc --noEmit` (backend + workers) |
| `npm run typecheck` | Typecheck all workspaces |
| `npm test` | Vitest (backend + workers via Turbo) |
| `npm run test:e2e` | Playwright frontend E2E (`frontend/`) |
| `npm run build` | Production build (Turbo) |

## Pull requests

- Keep changes focused and consistent with existing style.
- Run `npm run lint`, `npm run typecheck`, and `npm test` before opening a PR.
- Describe the problem and the fix in complete sentences; link related issues when applicable.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0, the same as this project ([LICENSE](LICENSE)).
