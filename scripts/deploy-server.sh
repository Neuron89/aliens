#!/usr/bin/env bash
# Update + rebuild + restart the MU/TH/UR server deploy (systemd unit "muthur").
# Runs ON the server (CT 107) from any cwd:   /opt/muthur/update.sh
# Idempotent: pulls (fast-forward only), reinstalls deps, rebuilds the client,
# restarts the service and health-checks it. "web app/.env" (gitignored) and the
# data dir are never touched. Env overrides: MUTHUR_DIR, MUTHUR_BRANCH, MUTHUR_PORT.
set -euo pipefail

REPO_DIR="${MUTHUR_DIR:-/opt/muthur}"
BRANCH="${MUTHUR_BRANCH:-expandable-system}"
APP_DIR="$REPO_DIR/web app"
SERVICE=muthur
export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Port: MUTHUR_PORT, else PORT= from the app's .env, else 3100.
PORT="${MUTHUR_PORT:-}"
if [ -z "$PORT" ] && [ -f "$APP_DIR/.env" ]; then
  PORT="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?PORT[[:space:]]*=[[:space:]]*["'\'']\{0,1\}\([0-9]\+\).*/\2/p' "$APP_DIR/.env" | tail -n1)"
fi
PORT="${PORT:-3100}"

echo "== git ($BRANCH) =="
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone --depth 1 -b "$BRANCH" https://github.com/Neuron89/aliens.git "$REPO_DIR"
else
  git -C "$REPO_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$REPO_DIR" checkout -q "$BRANCH"
  git -C "$REPO_DIR" merge --ff-only FETCH_HEAD
fi

echo "== npm ci =="
cd "$APP_DIR"
npm ci --no-audit --no-fund --loglevel=error

echo "== build =="
npm run build --silent

echo "== restart $SERVICE =="
systemctl restart "$SERVICE"

code=000
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"
  [ "$code" = "200" ] && break
  sleep 1
done
for p in tts gm portrait; do
  printf '  /api/%s/status -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/$p/status" || true)"
done
hash="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
if [ "$code" = "200" ]; then
  echo "OK  muthur @ $hash  ->  http://127.0.0.1:$PORT/  (HTTP $code)"
else
  echo "FAIL  muthur @ $hash  did not answer 200 on :$PORT (got $code). Logs: journalctl -u $SERVICE -n 50" >&2
  exit 1
fi
