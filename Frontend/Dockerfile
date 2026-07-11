# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the Vite/React SPA
# ---------------------------------------------------------------------------
# node 22: rolldown-vite (@rolldown/plugin-babel) requires node >= 22.12.
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first so this layer is cached when only source changes.
# `npm install` (not the stricter `npm ci`): the committed package-lock.json is
# generated on Windows and is missing Linux/musl-only optional deps (e.g.
# @emnapi/* for rolldown's WASM fallback), which makes `npm ci` refuse to run.
# `npm install` resolves the right platform packages from the same lockfile.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# API base URL baked into the bundle at build time.
#
# The app reads `import.meta.env.VITE_API_BASE` (src/api/client.js & auth.js)
# and falls back to http://localhost:8000 when it is FALSY. In this container
# nginx serves the SPA and reverse-proxies the API on the SAME origin, so the
# browser should call the API with relative paths (e.g. /imboni/...).
#
# NOTE: because the app uses `VITE_API_BASE || 'http://localhost:8000'`, an
# empty string still falls back to localhost. To get true same-origin behaviour
# for a specific deployment, pass the public origin at build time, e.g.:
#     docker build --build-arg VITE_API_BASE=https://school1.localhost .
# Leave it empty for the multi-tenant setup only once the source treats an empty
# value as "relative/same-origin" (see report notes).
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE

# Copy the rest of the source and build → outputs to /app/dist
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — serve the built assets and reverse-proxy the API with nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine

# Replace the default site with our SPA + reverse-proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship the compiled SPA.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
