# syntax=docker/dockerfile:1

# Node 22 (LTS with headroom past the >=20 floor the codebase requires for
# crypto.subtle / ESM top-level await). "bookworm" (Debian glibc), not
# "alpine" (musl): workers/ai depends on sharp, and glibc has the smoothest
# native-module story for sharp's prebuilt libvips binaries.
#
# "-slim" note: sharp ships prebuilt binaries per-platform (see
# @img/sharp-linux-x64 / @img/sharp-libvips-linux-x64 in package-lock.json),
# so on linux/amd64 or linux/arm64 with glibc it should install without a
# C/C++ toolchain — "slim" is expected to be sufficient. This is a build-time
# assumption that hasn't been verified with an actual `docker build` in this
# environment (no daemon available here) — if the `npm ci` step below fails
# while compiling sharp/libvips from source, install build tools first:
#   apt-get update && apt-get install -y --no-install-recommends python3 build-essential
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production

WORKDIR /app

# ---- Dependency layer -------------------------------------------------
# Copy only the manifests needed for npm to resolve the workspace graph, so
# this layer is cached across builds unless a package.json or the lockfile
# actually changes (source-only edits won't invalidate `npm ci`).
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY workers/ai/package.json workers/ai/package.json

RUN npm ci

# ---- Source layer -------------------------------------------------------
# Everything runs directly from TypeScript source via tsx — there is no
# build/compile step for services/api or workers/ai (tsc is used only for
# typecheck, not for producing a dist/ that ships to production).
COPY . .

# Informational only — does not publish/restrict the port. Matches
# defaultPort in services/api/src/apiServerProcess.ts.
EXPOSE 8787

# Default command runs the API server. This image can run any @mongchi/api
# runtime command by overriding CMD at deploy time, e.g.:
#   docker run <image> npm --workspace @mongchi/api run start:generation-worker
#   docker run <image> npm --workspace @mongchi/api run start:privacy-worker
#   docker run <image> npm --workspace @mongchi/api run start:outbox-worker
#   docker run <image> npm --workspace @mongchi/api run start:chat-retention-worker
#   docker run <image> npm --workspace @mongchi/api run start:migrate
CMD ["npm", "--workspace", "@mongchi/api", "run", "start:api"]
