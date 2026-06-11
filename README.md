# playwright-runner

## What This Is

A standalone, Dockerized Playwright test runner with a web UI. It packages `@playwright/test` and a Chromium browser into a container that can smoke-test **any** web application — local or deployed — by pointing the `TARGET_URL` environment variable at it. No test code lives in the apps being tested; this project is the single, disposable test harness for all of them.

## Architecture

```text
┌─────────────────┐          ┌──────────────────────────────┐
│  Your browser    │  :8080   │  Docker container             │
│  localhost:8080  ├─────────►│  playwright-runner            │
│  (Playwright UI) │          │  Playwright 1.49 + Chromium   │
└─────────────────┘          └──────────────┬───────────────┘
                                            │  TARGET_URL
                             ┌──────────────┴───────────────┐
                             ▼                              ▼
              host.docker.internal:3000         any public URL
              (app running on the host          (e.g. https://
               machine, default target)          customerquote.vercel.app)
```

The container runs Playwright's UI server bound to `0.0.0.0:8080`, which Docker maps to `localhost:8080` on your machine. Tests navigate to relative paths, which resolve against `TARGET_URL` — so the same suite runs against an app on your host, a different port, or a deployed site.

## Quick Start

```bash
docker compose up --build
```

Then open **<http://localhost:8080>** and click the play button to run the tests. By default they target `http://host.docker.internal:3000` — an app running on port 3000 of your host machine.

## Changing Targets

`TARGET_URL` is read at container start; set it inline to point the suite anywhere:

```bash
# Default: app running on the host at port 3000
docker compose up --build

# App on a different local port
TARGET_URL=http://host.docker.internal:5173 docker compose up

# A deployed site
TARGET_URL=https://customerquote.vercel.app docker compose up
```

Note: anything on your host machine must be addressed as `host.docker.internal`, not `localhost` — inside the container, `localhost` is the container itself.

## Writing Tests

The `./tests` folder is volume-mounted into the container, so edits on the host are picked up live — no rebuild, no restart:

1. Keep `docker compose up` running.
2. Edit or add `*.spec.ts` files in [tests/](tests/).
3. In the UI at localhost:8080, re-run the tests — or toggle **watch mode** (the eye icon next to a test) to re-run automatically on every file save.

Tests should navigate with relative paths (`page.goto('/')`) so they stay target-agnostic. See [tests/default.spec.ts](tests/default.spec.ts) for the pattern, including how known dev-server console noise is filtered.

The HTML report is also mounted out to `./playwright-report` on the host.

---

For the full from-scratch rebuild guide, bare-metal (no Docker) install, troubleshooting, and design rationale, see [SETUP.md](SETUP.md).
