#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Imboni — Deployment script for Oracle Free Tier (Ampere A1 / ARM64)
# ============================================================================
# Usage:
#   1. SSH into your Oracle instance
#   2. Clone / copy this repo to /opt/imboni (or any path)
#   3. Run: bash deploy.sh
#
# What it does:
#   - Installs Docker Engine + Compose plugin (if missing)
#   - Creates production .env.prod from template
#   - Builds & starts the stack via docker-compose.prod.yml
#   - Runs DB migrations and seeds the first tenant
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/imboni}"
DOMAIN="${DOMAIN:-imboni.rw}"
EMAIL="${EMAIL:-admin@imboni.rw}"
DB_PASS="${DB_PASS:-change-me-$(openssl rand -hex 12)}"
SECRET_KEY="${SECRET_KEY:-$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")}"

# ---------------------------------------------------------------------------
# 1. Install Docker (Ubuntu / Debian / Oracle Linux)
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    echo "[deploy] Docker not found — installing..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    sudo systemctl enable docker
    sudo systemctl start docker

    echo "[deploy] Docker installed."
else
    echo "[deploy] Docker already present: $(docker --version)"
fi

# ---------------------------------------------------------------------------
# 2. Ensure deploy directory exists with correct ownership
# ---------------------------------------------------------------------------
sudo mkdir -p "${DEPLOY_DIR}"
sudo chown -R "$USER":"$USER" "${DEPLOY_DIR}"

cd "${DEPLOY_DIR}"

# ---------------------------------------------------------------------------
# 3. Set up production environment file
# ---------------------------------------------------------------------------
if [[ ! -f .env.prod ]]; then
    echo "[deploy] Creating .env.prod..."
    cp .env.prod.example .env.prod

    # Use perl to replace placeholders (portable across macOS / Linux)
    perl -pi -e "s|ALLOWED_HOSTS=.*|ALLOWED_HOSTS=.${DOMAIN},${DOMAIN}|g" .env.prod
    perl -pi -e "s|THE_SECRET_KEY=.*|THE_SECRET_KEY=${SECRET_KEY}|g" .env.prod
    perl -pi -e "s|DATABASE_PASSWORD=.*|DATABASE_PASSWORD=${DB_PASS}|g" .env.prod
else
    echo "[deploy] .env.prod already exists — skipping creation."
fi

# ---------------------------------------------------------------------------
# 4. Build and start stacks in detached mode
# ---------------------------------------------------------------------------
echo "[deploy] Building and starting containers..."
docker compose \
    --env-file .env.prod \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    up -d --build

# ---------------------------------------------------------------------------
# 5. Wait for backend healthcheck to pass before provisioning
# ---------------------------------------------------------------------------
echo "[deploy] Waiting for backend to be healthy..."
BACKEND="${DEPLOY_DIR}"
for i in $(seq 1 60); do
    if docker inspect --format='{{.State.Health.Status}}' imboni-backend-1 2>/dev/null | grep -q healthy; then
        echo "[deploy] Backend is healthy."
        break
    fi
    if [[ $i -eq 60 ]]; then
        echo "[deploy] Backend did not become healthy in time. Check: docker compose logs backend"
        exit 1
    fi
    sleep 5
done

# ---------------------------------------------------------------------------
# 6. Provision first tenant (idempotent — hello-tenant)
# ---------------------------------------------------------------------------
echo "[deploy] Provisioning first tenant (${DOMAIN})..."
docker compose \
    --env-file .env.prod \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    exec -T backend python manage.py provision_school \
        --name "Imboni School" \
        --subdomain "$(echo "${DOMAIN}" | sed 's/\..*//')" \
        --admin-email "${EMAIL}" \
    || echo "[deploy] Provisioning skipped (may already exist)."

echo ""
echo "========================================"
echo " Imboni deployment complete!"
echo "========================================"
echo "  Domain : https://${DOMAIN}"
echo "  Admin  : ${EMAIL}"
echo ""
echo "  Next steps:"
echo "    1. Point your domain A record to this server's IP"
echo "    2. Open ports 80/443 in Oracle Cloud VCN security list"
echo "    3. (Optional) Add TLS certs to Frontend/nginx.conf if not using a proxy"
echo ""
echo "  Useful commands:"
echo "    docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "    docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml ps"
