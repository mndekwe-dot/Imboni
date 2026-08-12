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
# The app reads `import.meta.env.VITE_API_BASE` (src/api/client.js and
# src/hooks/useNotifications.js) and distinguishes three cases:
#
#   undefined  -> http://localhost:8000  (plain `npm run dev`, no proxy)
#   ""         -> same origin            <- what this container wants
#   a URL      -> that host
#
# The empty default below is therefore correct here: nginx serves the SPA and
# reverse-proxies the API on the SAME origin, so the browser calls /imboni/...
# relative to whichever school subdomain it is on — which is also what lets the
# Host header select the right tenant schema. Baking in a fixed origin would
# send every school to one host, so only override this for a single-tenant
# deployment, e.g.:
#     docker build --build-arg VITE_API_BASE=https://school1.example.com .
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
