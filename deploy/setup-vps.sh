#!/usr/bin/env bash
# Installation de Glouglou Arena sur un VPS Hostinger (Ubuntu 22.04 / 24.04), à lancer en root :
#   bash <(curl -fsSL https://raw.githubusercontent.com/<TON_COMPTE>/<TON_DEPOT>/main/deploy/setup-vps.sh) <TON_COMPTE>/<TON_DEPOT> jeu.tondomaine.fr
set -euo pipefail
REPO="${1:?usage: setup-vps.sh <compte/depot> <domaine>}"
DOMAIN="${2:?usage: setup-vps.sh <compte/depot> <domaine>}"
APP_DIR=/var/www/ogs

echo "== Paquets"
apt-get update -y
apt-get install -y curl git nginx ufw
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2 >/dev/null

echo "== Code"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "https://github.com/$REPO.git" "$APP_DIR"; fi
cd "$APP_DIR"
npm install --omit=dev --no-audit --no-fund
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
  echo ">> Pense à renseigner DATABASE_URL dans $APP_DIR/.env (sinon : fichier data/store.json)"
fi

echo "== pm2"
pm2 start deploy/ecosystem.config.js --update-env
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "== nginx"
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx.conf > /etc/nginx/sites-available/ogs
ln -sf /etc/nginx/sites-available/ogs /etc/nginx/sites-enabled/ogs
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== Pare-feu"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo "== HTTPS (Let's Encrypt)"
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo ">> certbot a échoué : vérifie que le DNS de $DOMAIN pointe bien vers ce VPS, puis relance : certbot --nginx -d $DOMAIN"

echo
echo "Glouglou Arena tourne sur https://$DOMAIN  (logs : pm2 logs ogs)"
