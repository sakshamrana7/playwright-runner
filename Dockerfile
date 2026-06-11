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
