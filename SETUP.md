# Setup

## Prerequisites

- **Docker Desktop** — that's it. The container brings its own Node, Playwright, and Chromium.

(For running without Docker, see [Bare-Metal Install](#bare-metal-install-no-docker) — that path needs Node.js instead.)

## From-Scratch Rebuild (10 minutes)

Every file is reproduced in full below — this section is sufficient to rebuild the project with zero other sources.

### Minute 0–1: Create the project

```bash
mkdir playwright-runner && cd playwright-runner
mkdir tests
```

### Minute 1–2: `package.json`

```json
{
  "name": "playwright-runner",
  "version": "1.0.0",
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui-host=0.0.0.0 --ui-port=8080"
  },
  "devDependencies": {
    "@playwright/test": "1.49.0"
  }
}
```

### Minute 2–3: `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.TARGET_URL ?? 'http://host.docker.internal:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
});
```

### Minute 3–5: `tests/default.spec.ts`

```ts
import { test, expect } from '@playwright/test';

/**
 * Generic smoke tests — target-agnostic by design.
 *
 * Every test navigates via a relative path ('/'), which Playwright resolves
 * against the baseURL configured in playwright.config.ts (driven by the
 * TARGET_URL environment variable). Nothing here assumes a specific app,
 * framework, or page content beyond the basics any healthy web page should
 * satisfy, so this suite can be pointed at ANY target without modification.
 */

test.describe('smoke', () => {
  test('page responds with status below 400', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
  });

  test('page has a non-empty title', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveTitle('');
  });

  test('body is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  // Dev-server tooling noise that doesn't indicate a broken page. HMR
  // WebSockets (Next.js/webpack/Vite) fail to connect through
  // host.docker.internal when the target runs in dev mode on the host.
  const IGNORED_CONSOLE_ERRORS = [
    /webpack-hmr/,
    /WebSocket connection to .*\/_next\//,
    /\[vite\] failed to connect/,
  ];

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(message.text()))
      ) {
        errors.push(message.text());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('at least one h1 or h2 heading is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
```

### Minute 5–6: `Dockerfile`

```dockerfile
# The image tag version MUST match the @playwright/test version in
# package.json (1.49.0). The image ships browser binaries pre-installed
# for exactly that Playwright version; a mismatch means the runner looks
# for a browser build (e.g. chromium-1148) that isn't in the image and
# fails at launch. Bump both together when upgrading.
FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /runner

# Copy package files and install dependencies in their own layer so
# Docker can cache it — config and test changes won't trigger a reinstall.
COPY package.json package-lock.json ./
RUN npm ci

COPY playwright.config.ts ./
COPY tests ./tests

EXPOSE 8080

# Bind the UI server to 0.0.0.0, not the default localhost: inside a
# container, localhost is the container's own loopback interface, which
# is unreachable from the host. 0.0.0.0 listens on all interfaces so
# Docker's port mapping (-p 8080:8080) can forward traffic in.
CMD ["npx", "playwright", "test", "--ui-host=0.0.0.0", "--ui-port=8080"]
```

The Dockerfile runs `npm ci`, which needs a `package-lock.json`. Generate one without downloading browsers:

```bash
npm install --package-lock-only
```

(A plain `npm install` works too if you have Node locally.)

### Minute 6–7: `docker-compose.yml`

```yaml
services:
  playwright:
    build: .
    container_name: playwright-runner
    ports:
      - "8080:8080"
    environment:
      - TARGET_URL=${TARGET_URL:-http://host.docker.internal:3000}
    # On Docker Desktop (Mac/Windows) host.docker.internal resolves out of
    # the box; on Linux it doesn't exist unless mapped to the host gateway
    # like this. With the entry present, the same hostname works everywhere.
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # Live-mount tests so edits on the host show up in the container
    # immediately — no image rebuild needed. The report mount writes the
    # HTML report back to the host so it survives the container.
    volumes:
      - ./tests:/runner/tests
      - ./playwright-report:/runner/playwright-report
```

### Minute 7–9: Build and start

```bash
docker compose up --build
```

The first build downloads the ~2 GB Playwright base image; subsequent builds are seconds. Wait for:

```text
playwright-runner  | Listening on http://0.0.0.0:8080
```

### Minute 9–10: Run the tests

Open <http://localhost:8080>, make sure something is serving on host port 3000 (or set `TARGET_URL`), and click the play button. Five green checkmarks and you're done.

## Bare-Metal Install (no Docker)

Three commands get you from a clean checkout to passing tests:

```bash
# 1. Install the test runner package
npm install

# 2. Download the Chromium browser binary
npx playwright install chromium

# 3. Run the suite against a locally running app
TARGET_URL=http://localhost:3000 npx playwright test
```

(Bare-metal targets use `localhost`, not `host.docker.internal` — that hostname only exists inside containers.)

### The three layers

Playwright is split into three separately-installed layers, and it helps to know which command owns which:

1. **npm package (the runner)** — `npm install` brings in `@playwright/test`, which is the test runner, assertions, and browser-automation API. It contains no browser.

2. **Browser binaries (separate download)** — `npx playwright install chromium` downloads a Playwright-built Chromium. On macOS it lands in `~/Library/Caches/ms-playwright/`, version-pinned to your `@playwright/test` version (e.g. `chromium-1148` for 1.49.0) and entirely separate from any system Chrome you have installed. Upgrading the npm package means re-running this command to fetch the matching browser build.

3. **OS dependencies** — shared libraries the browser needs from the operating system. On macOS these are already present, so there's nothing to do. On Linux you must install them explicitly with `npx playwright install-deps` (requires sudo), or combine both steps with `npx playwright install --with-deps chromium`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Executable doesn't exist at /ms-playwright/chromium-...` | Docker image tag doesn't match the `@playwright/test` version in `package.json` — the image only ships browser builds for its own version | Make the `FROM mcr.microsoft.com/playwright:vX.Y.Z-noble` tag and the package version identical; always bump them together |
| Tests fail with `net::ERR_CONNECTION_REFUSED` against a host app | `TARGET_URL` uses `localhost`, which inside a container is the container itself, not your machine | Use `http://host.docker.internal:<port>` for anything running on the host (works on Linux too via the `extra_hosts` entry in docker-compose.yml) |
| UI server runs but <http://localhost:8080> won't load | UI bound to `localhost` inside the container, unreachable through Docker's port mapping | Keep `--ui-host=0.0.0.0` in the Dockerfile `CMD`; port mapping can only forward to an interface the server actually listens on |
| Console-error test fails on `WebSocket connection to 'ws://...:3000/_next/webpack-hmr' failed` | Target is a Next.js **dev** server; its hot-module-reload WebSocket handshake doesn't survive the trip through `host.docker.internal` | Test the production build instead: `npm run build && npm run start` in the target app. (The smoke suite also filters this known noise pattern as a fallback.) |

## Design Rationale

- **Disposable over precious.** Nothing in the container is state worth keeping — image, container, and report can all be deleted and rebuilt in minutes from this document. If something gets weird, `docker compose down` and rebuild rather than debug.
- **The version pin is the contract.** `@playwright/test` 1.49.0 in `package.json` and `v1.49.0-noble` in the Dockerfile are the same fact written twice; keeping them identical is the one invariant the whole setup depends on.
- **Targets are an env var, not code.** `TARGET_URL` selects what's being tested at run time, so one image tests every app. Test files never hardcode a host.
- **The UI is a runner, not an editor.** Tests are edited on the host and live-mounted in; git remains the source of truth, and the container never holds anything unique.
