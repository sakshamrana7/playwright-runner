# Setup

## Prerequisites

<!-- TODO -->

## From-Scratch Rebuild (10 minutes)

<!-- TODO -->

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

### The three layers

Playwright is split into three separately-installed layers, and it helps to know which command owns which:

1. **npm package (the runner)** — `npm install` brings in `@playwright/test`, which is the test runner, assertions, and browser-automation API. It contains no browser.

2. **Browser binaries (separate download)** — `npx playwright install chromium` downloads a Playwright-built Chromium. On macOS it lands in `~/Library/Caches/ms-playwright/`, version-pinned to your `@playwright/test` version (e.g. `chromium-1148` for 1.49.0) and entirely separate from any system Chrome you have installed. Upgrading the npm package means re-running this command to fetch the matching browser build.

3. **OS dependencies** — shared libraries the browser needs from the operating system. On macOS these are already present, so there's nothing to do. On Linux you must install them explicitly with `npx playwright install-deps` (requires sudo), or combine both steps with `npx playwright install --with-deps chromium`.

## Troubleshooting

<!-- TODO -->

## Design Rationale

<!-- TODO -->
