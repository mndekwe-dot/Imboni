#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Imboni — first-time TLS certificate bootstrap
# ============================================================================
# Run this ONCE on the server, before the first production `up`.
#
#   cd /opt/imboni
#   bash scripts/init-letsencrypt.sh
#
# Why a bootstrap step is needed at all:
#
#   nginx refuses to start if `ssl_certificate` points at a file that does not
#   exist. But certbot's http-01 challenge needs a web server already running
#   on port 80 to answer it. That is a deadlock, so this script breaks it:
#
#     1. write a throwaway self-signed certificate at the real path
#     2. start nginx, which is now willing to boot
#     3. run certbot, which deletes the fake cert and gets a real one
#     4. reload nginx so it serves the real certificate
#
# Reads DOMAIN, CERT_EMAIL and CERT_SUBDOMAINS from .env.prod.
# ============================================================================

COMPOSE="docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml"

if [[ ! -f .env.prod ]]; then
    echo "ERROR: .env.prod not found. Copy .env.prod.example and fill it in first." >&2
    exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.prod; set +a

: "${DOMAIN:?set DOMAIN in .env.prod, e.g. imboni.rw}"
# NOTE: no apostrophes inside ${VAR:?message}. Bash parses the message as part
# of the expansion, so a lone quote there is an unterminated string and the
# whole script fails to parse.
: "${CERT_EMAIL:?set CERT_EMAIL in .env.prod for certificate expiry warnings}"

# Which hostnames go on the certificate.
#
# IMPORTANT: http-01 cannot issue a wildcard (*.imboni.rw). Every school
# subdomain must be listed explicitly, and a NEW school needs the certificate
# reissued with its subdomain added (re-run this script). If you need true
# wildcard coverage, that requires a dns-01 challenge and a certbot DNS plugin
# for your DNS provider.
CERT_SUBDOMAINS="${CERT_SUBDOMAINS:-}"
DOMAIN_ARGS="-d ${DOMAIN} -d www.${DOMAIN}"
for sub in ${CERT_SUBDOMAINS//,/ }; do
    [[ -n "$sub" ]] && DOMAIN_ARGS="${DOMAIN_ARGS} -d ${sub}.${DOMAIN}"
done

STAGING="${STAGING:-0}"
STAGING_ARG=""
if [[ "$STAGING" != "0" ]]; then
    # Let's Encrypt rate-limits failed real requests hard (5 per hostname per
    # hour). Set STAGING=1 for the first attempt to prove DNS and firewall are
    # right, then re-run with STAGING=0 for a trusted certificate.
    STAGING_ARG="--staging"
    echo "[init] STAGING MODE — the resulting certificate will NOT be trusted by browsers."
fi

echo "[init] Domain      : ${DOMAIN}"
echo "[init] Certificate : ${DOMAIN_ARGS}"
echo "[init] Contact     : ${CERT_EMAIL}"
echo ""

# ---------------------------------------------------------------------------
# 1. Throwaway certificate so nginx can start
# ---------------------------------------------------------------------------
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
echo "[init] Writing a temporary self-signed certificate..."
$COMPOSE run --rm --entrypoint sh certbot -c "
    mkdir -p '${CERT_PATH}' &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout '${CERT_PATH}/privkey.pem' \
        -out '${CERT_PATH}/fullchain.pem' \
        -subj '/CN=${DOMAIN}' 2>/dev/null
"

# ---------------------------------------------------------------------------
# 2. Start the stack (nginx will now boot)
# ---------------------------------------------------------------------------
echo "[init] Starting the stack..."
$COMPOSE up -d --build

echo "[init] Waiting for nginx to answer on port 80..."
for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://localhost/.well-known/acme-challenge/ping" 2>/dev/null \
       || curl -fsS -o /dev/null -w '%{http_code}' "http://localhost/" 2>/dev/null | grep -qE '30[12]|200'; then
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "[init] nginx never answered on :80. Check: $COMPOSE logs web" >&2
        exit 1
    fi
    sleep 2
done

# ---------------------------------------------------------------------------
# 3. Replace it with a real certificate
# ---------------------------------------------------------------------------
echo "[init] Deleting the temporary certificate..."
$COMPOSE run --rm --entrypoint sh certbot -c "rm -rf '${CERT_PATH}' /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf"

echo "[init] Requesting a certificate from Let's Encrypt..."
# shellcheck disable=SC2086
$COMPOSE run --rm --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    ${STAGING_ARG} \
    ${DOMAIN_ARGS} \
    --email "${CERT_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --keep-until-expiring

# ---------------------------------------------------------------------------
# 4. Serve it
# ---------------------------------------------------------------------------
echo "[init] Reloading nginx..."
$COMPOSE exec -T web nginx -s reload

echo ""
echo "========================================"
echo " TLS is live: https://${DOMAIN}"
echo "========================================"
echo "Renewal runs automatically in the certbot container every 12h,"
echo "and nginx reloads every 6h to pick up a renewed certificate."
echo ""
echo "When you add a new school, add its subdomain to CERT_SUBDOMAINS in"
echo ".env.prod and re-run this script to reissue the certificate."
