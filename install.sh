#!/usr/bin/env bash
# MU/TH/UR one-command installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/Neuron89/aliens/expandable-system/install.sh | bash
#
# or, from a cloned repo:  bash install.sh
#
# (Windows users: use install.ps1; Git Bash is not supported.)
# Installs into ~/muthur (override with MUTHUR_HOME), builds the app, writes start/stop
# launchers and starts the server on port 3100 (override with MUTHUR_PORT). Re-run it any
# time to update: saved sessions, portraits and imported packs live in <install dir>/data
# and are kept. No sudo needed unless Node.js has to be installed. Optional switches:
#   MUTHUR_BRANCH=main      install another branch
#   MUTHUR_NO_START=1       do not start the server at the end
#   MUTHUR_NO_BROWSER=1     do not open the browser
# Everything runs inside main(), so `curl | bash` reads the whole script before running it.

set -euo pipefail

main() {
  local REPO="Neuron89/aliens"
  local BRANCH="${MUTHUR_BRANCH:-expandable-system}"
  local PORT="${MUTHUR_PORT:-3100}"
  local ROOT="${MUTHUR_HOME:-$HOME/muthur}"
  local TARBALL="https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz"
  local APP="$ROOT/app" DATA="$ROOT/data" LOGS="$ROOT/logs"

  say()  { printf '  %s\n' "$*"; }
  step() { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
  good() { printf '  \033[32m%s\033[0m\n' "$*"; }
  warn() { printf '  \033[33m%s\033[0m\n' "$*"; }
  die()  { printf '\n  \033[31mINSTALL FAILED: %s\033[0m\n' "$*" >&2; exit 1; }
  fetch() {  # fetch URL FILE
    if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then wget -q "$1" -O "$2"
    else die "Need curl or wget to download (e.g. sudo apt install curl)."; fi
  }

  printf '\n  \033[32mMU/TH/UR 6000 :: game terminal installer\033[0m\n'
  say "install folder : $ROOT"
  say "port           : $PORT"

  # ------------------------------------------------------------ Node.js
  node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true; }
  step "Checking for Node.js 20 or newer"
  local major
  major="$(node_major)"; major="${major:-0}"
  if [ "$major" -lt 20 ]; then
    if [ "$major" -gt 0 ]; then warn "Found Node.js $major; it is too old."; else warn "Node.js is not installed."; fi
    local SUDO=""
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
    if command -v brew >/dev/null 2>&1; then
      say "Installing Node.js with Homebrew..."
      brew install node </dev/null || true
    elif command -v apt-get >/dev/null 2>&1 && { [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ]; }; then
      say "Installing Node.js LTS from NodeSource (asks for your password)..."
      local ns="$(mktemp)"
      fetch "https://deb.nodesource.com/setup_lts.x" "$ns" \
        && $SUDO bash "$ns" </dev/null \
        && $SUDO apt-get install -y nodejs </dev/null || true
      rm -f "$ns"
    fi
    hash -r 2>/dev/null || true
    major="$(node_major)"; major="${major:-0}"
    if [ "$major" -lt 20 ]; then
      echo
      warn "Please install Node.js (the LTS version) from https://nodejs.org/en/download"
      warn "then open a new terminal and run the install command again."
      exit 1
    fi
  fi
  local NODE NPM
  NODE="$(command -v node)"
  NPM="$(command -v npm || true)"
  [ -n "$NPM" ] || die "npm was not found next to node ($NODE). Reinstall Node.js from https://nodejs.org"
  good "Node.js $(node -v) ($NODE)"

  # ------------------------------------------------------------ stop a running copy
  mkdir -p "$ROOT" "$DATA/content" "$LOGS"
  local PIDFILE="$ROOT/server.pid"
  if [ -f "$PIDFILE" ]; then
    local old; old="$(head -n1 "$PIDFILE" 2>/dev/null || true)"
    if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
      step "Stopping the running MUTHUR server"
      kill "$old" 2>/dev/null || true
      for _ in $(seq 1 30); do kill -0 "$old" 2>/dev/null || break; sleep 0.5; done
      kill -9 "$old" 2>/dev/null || true
      good "stopped (pid $old)"
    fi
    rm -f "$PIDFILE"
  fi

  # ------------------------------------------------------------ get the source
  # Running from a checkout (install.sh next to "web app")? Use it instead of downloading.
  local SRC="" TMP="$ROOT/_download" here=""
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    [ -f "$here/web app/package.json" ] && SRC="$here/web app"
  fi
  if [ -n "$SRC" ]; then
    step "Using the local checkout: $SRC"
  else
    step "Downloading MU/TH/UR ($BRANCH branch)"
    rm -rf "$TMP"; mkdir -p "$TMP/x"
    say "$TARBALL"
    fetch "$TARBALL" "$TMP/source.tar.gz"
    say "unpacking..."
    tar -xzf "$TMP/source.tar.gz" -C "$TMP/x"
    local top; top="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    [ -f "$top/web app/package.json" ] || die 'The download did not contain "web app/package.json".'
    SRC="$top/web app"
  fi

  step "Copying the app into $APP"
  # Replace everything except node_modules (faster updates); never copy local build output,
  # runtime data, content packs or secrets from a checkout.
  mkdir -p "$APP"
  find "$APP" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
  (cd "$SRC" && tar -cf - --exclude=node_modules --exclude=./dist --exclude=./data --exclude=./content \
      --exclude=./.vite --exclude=./.env --exclude=./.env.local .) | (cd "$APP" && tar -xf -)
  rm -rf "$TMP"
  good "files in place"

  # ------------------------------------------------------------ npm install + build
  run_npm() {  # run_npm LABEL LOGFILE ARGS...
    local label="$1" log="$LOGS/$2"; shift 2
    say "$label (log: $log)"
    if ! (cd "$APP" && "$NPM" "$@" >"$log" 2>&1 </dev/null); then
      tail -n 25 "$log" | sed 's/^/    /'
      die "$label failed. Full log: $log"
    fi
  }
  step "Installing packages (first time takes a few minutes)"
  run_npm "npm install" npm-install.log install --no-audit --no-fund --loglevel=error
  good "packages installed"
  step "Building the client"
  run_npm "npm run build" build.log run build
  [ -f "$APP/dist/index.html" ] || die "The build finished but dist/index.html is missing. See $LOGS/build.log"
  good "client built"

  # ------------------------------------------------------------ launchers
  step "Writing launchers"
  cat >"$ROOT/muthur.sh" <<'LAUNCHER'
#!/usr/bin/env bash
# MUTHUR launcher (written by install.sh; re-running the installer overwrites it).
# Usage: muthur.sh start | stop | status
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/app"; DATA="$ROOT/data"; PIDFILE="$ROOT/server.pid"; LOG="$ROOT/logs/server.log"
PORT="${MUTHUR_PORT:-__PORT__}"
export PATH="$PATH:__NODE_DIR__"

running_pid() {
  [ -f "$PIDFILE" ] || return 1
  local p; p="$(head -n1 "$PIDFILE" 2>/dev/null || true)"
  [ -n "$p" ] && kill -0 "$p" 2>/dev/null && { echo "$p"; return 0; }
  return 1
}
answers() {
  if command -v curl >/dev/null 2>&1; then curl -fs -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"
  else wget -q -O /dev/null -T 2 "http://127.0.0.1:$PORT/"; fi
}
lan_ip() {
  local ip="" iface=""
  if [ "$(uname)" = "Darwin" ]; then
    iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
    [ -n "$iface" ] && ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  elif command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)"
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -Ev '^(127\.|169\.254\.|$)' | head -n1 || true)"
  fi
  echo "${ip:-<this-computer-IP>}"
}
show_urls() {
  local ip; ip="$(lan_ip)"
  echo
  printf '  \033[32mMU/TH/UR is running.\033[0m\n'
  echo "    GM (this computer) : http://localhost:$PORT"
  echo "    GM (tablet)        : http://$ip:$PORT"
  echo "    TV / table screen  : http://$ip:$PORT/tv"
  echo "    Players' phones    : http://$ip:$PORT  -> JOIN -> type the code the GM screen shows"
  echo "    (every device must be on the same Wi-Fi as this computer)"
  echo
  echo "  Stop it with: $ROOT/stop.sh"
}
do_stop() {
  local p
  if p="$(running_pid)"; then
    kill "$p" 2>/dev/null || true
    for _ in $(seq 1 30); do kill -0 "$p" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$p" 2>/dev/null || true
    echo "  MUTHUR server stopped (pid $p)."
  else
    echo "  MUTHUR server is not running."
  fi
  rm -f "$PIDFILE"
}
do_start() {
  local p
  if p="$(running_pid)"; then
    echo "  Already running (pid $p)."
  else
    rm -f "$PIDFILE"
    command -v node >/dev/null 2>&1 || { echo "  ERROR: Node.js was not found. Run the installer again." >&2; exit 1; }
    [ -f "$APP/dist/index.html" ] || { echo "  ERROR: the app is not built. Run the installer again." >&2; exit 1; }
    if answers; then echo "  ERROR: another program already uses port $PORT. Close it or set MUTHUR_PORT." >&2; exit 1; fi
    mkdir -p "$DATA/content" "$(dirname "$LOG")"
    echo "=== start $(date) port $PORT ===" >>"$LOG"
    echo "  Starting MUTHUR on port $PORT..."
    (cd "$APP" && PORT="$PORT" DATA_DIR="$DATA" CONTENT_DIR="$DATA/content" nohup node server/index.js >>"$LOG" 2>&1 </dev/null &
     echo $! >"$PIDFILE")
    p="$(head -n1 "$PIDFILE")"
    local ok=0
    for _ in $(seq 1 60); do
      if answers; then ok=1; break; fi
      kill -0 "$p" 2>/dev/null || break
      sleep 0.5
    done
    if [ "$ok" -ne 1 ]; then
      tail -n 15 "$LOG" | sed 's/^/    /'
      kill "$p" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "  ERROR: the server did not answer on port $PORT. Log: $LOG" >&2
      exit 1
    fi
    printf '  \033[32mserver answering (pid %s)\033[0m\n' "$p"
    if [ "${MUTHUR_NO_BROWSER:-}" != "1" ]; then
      if command -v open >/dev/null 2>&1 && [ "$(uname)" = "Darwin" ]; then open "http://localhost:$PORT/" >/dev/null 2>&1 || true
      elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT/" >/dev/null 2>&1 & fi
    fi
  fi
  show_urls
}
case "${1:-start}" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) if p="$(running_pid)"; then echo "  running (pid $p) on port $PORT"; show_urls; else echo "  not running"; fi ;;
  *)      echo "usage: $0 start|stop|status" >&2; exit 1 ;;
esac
LAUNCHER
  local nd; nd="$(dirname "$NODE")"
  sed -i.bak -e "s|__PORT__|$PORT|" -e "s|__NODE_DIR__|$nd|" "$ROOT/muthur.sh" && rm -f "$ROOT/muthur.sh.bak"
  printf '#!/usr/bin/env bash\nexec "$(dirname "$0")/muthur.sh" start\n' >"$ROOT/start.sh"
  printf '#!/usr/bin/env bash\nexec "$(dirname "$0")/muthur.sh" stop\n' >"$ROOT/stop.sh"
  chmod +x "$ROOT/muthur.sh" "$ROOT/start.sh" "$ROOT/stop.sh"
  if [ "$(uname)" = "Darwin" ]; then  # double-clickable in Finder
    printf '#!/usr/bin/env bash\n"$(dirname "$0")/muthur.sh" start\n' >"$ROOT/Start MUTHUR.command"
    printf '#!/usr/bin/env bash\n"$(dirname "$0")/muthur.sh" stop\n' >"$ROOT/Stop MUTHUR.command"
    chmod +x "$ROOT/Start MUTHUR.command" "$ROOT/Stop MUTHUR.command"
  fi
  good "start.sh and stop.sh in $ROOT"

  # ------------------------------------------------------------ start
  if [ "${MUTHUR_NO_START:-}" != "1" ]; then
    step "Starting the server"
    "$ROOT/muthur.sh" start || die "The server did not start; see the messages above."
  fi

  echo
  good "Install complete. Next time run: $ROOT/start.sh"
  say  "Update later by running the same install command again (your saved games in $DATA are kept)."
  if [ "$(uname)" = "Darwin" ]; then
    say "If macOS asks whether \"node\" may accept incoming connections, click Allow (phones need it)."
  elif command -v ufw >/dev/null 2>&1; then
    say "Phones can't connect? If the ufw firewall is on: sudo ufw allow $PORT/tcp"
  fi
}

main "$@"
