# Remote play (muthur.kys-media.com)

Friends play from anywhere by opening **https://muthur.kys-media.com**. The game
server runs on the home server; Cloudflare's tunnel carries the traffic in and
Cloudflare Access decides who may open the page.

## Architecture

```
player phone / TV / GM laptop (anywhere)
        │  HTTPS + WebSocket
        ▼
Cloudflare edge ── Access (email one-time PIN) ── TLS ends here
        │  outbound-only tunnel "homelab"
        ▼
cloudflared in CT 110 (192.168.1.59, node pve)
        │  plain HTTP on the LAN
        ▼
CT 107 "ai" (192.168.1.37, node sr650)
  muthur.service: node server/index.js on :3100
  ├─ Kokoro TTS   http://127.0.0.1:8880/v1    (voice)
  ├─ Ollama       http://127.0.0.1:11434/v1   (AI GM drafts)
  └─ ComfyUI      http://127.0.0.1:8188       (portraits)
```

| What | Where |
| --- | --- |
| Code checkout (shallow, branch `expandable-system`) | `/opt/muthur` |
| App folder / config | `/opt/muthur/web app/.env` (mode 600, gitignored, never touched by updates) |
| Saved games, runtime content packs, TTS cache, portraits | `/models/muthur/data` (`sessions/`, `content/`, `tts/`, `art/portraits/`) — on the `tank` pool |
| Service | `systemd` unit `muthur` (`/etc/systemd/system/muthur.service`), runs as root, `Restart=always` |
| Update script | `/opt/muthur/update.sh` (same file as `scripts/deploy-server.sh` in this repo) |

The `.env` holds `PORT=3100`, `DATA_DIR`, `CONTENT_DIR`, `MAX_GAMES=200`,
`TTS_URL`, `GM_URL`, `GM_MODEL`, `COMFY_URL` and `API_TOKEN`. The unit loads it
with `EnvironmentFile=` because `DATA_DIR`, `CONTENT_DIR` and `MAX_GAMES` are
read when the server modules load, before `server/generator/env.js` gets a
chance to read `.env`.

## Cloudflare dashboard setup (one-time, by hand)

### 1. Public hostname on the tunnel

1. https://one.dash.cloudflare.com → **Networks → Tunnels** → **homelab** → **Configure**.
2. Tab **Public Hostname** → **Add a public hostname**.
3. Subdomain `muthur`, Domain `kys-media.com`, Path empty.
4. Service: Type **HTTP**, URL `192.168.1.37:3100`.
5. Save. (Same pattern as `calendar.kys-media.com` → `192.168.1.37:8095`.)

WebSockets go through the tunnel with no extra setting (Socket.io also falls
back to long-polling). CT 110 already reaches `http://192.168.1.37:3100` (checked
with curl, HTTP 200).

### 2. Access application (the gate) — do this before sharing the link

1. Zero Trust → **Access → Applications** → **Add an application** → **Self-hosted**.
2. Application name `MU/TH/UR`; Session duration **1 month**.
3. Application domain: subdomain `muthur`, domain `kys-media.com` (path empty, so `/tv`, `/api` and `/socket.io` are covered too).
4. Identity providers: **One-time PIN** (enable it under Settings → Authentication if it is not listed). Turn on "instant auth" if only one IdP is selected.
5. Policy: name `Players`, Action **Allow**, Include → **Emails** → list each friend's address
   (or **Emails ending in** `@example.com` for a whole domain). Add yourself.
6. Save. Opening the domain should now show the Cloudflare login page; a friend
   enters their email, gets a 6-digit code, and lands in the app.

The TV / board screen logs in once with its own allowed email; the 1-month
session keeps it signed in.

## What players, the TV and the GM do

Exactly what they do on the LAN, with the domain instead of the IP:

- **GM**: open `https://muthur.kys-media.com/`, create the game, set the GM PIN, share the room code.
- **Players**: open `https://muthur.kys-media.com/`, join with the room code.
- **TV / table board**: `https://muthur.kys-media.com/tv` (or `/tv/CODE` to jump straight to a game).
- Content/generate writes (pack editor, generator, recap, portraits, TTS, AI GM) need the
  `API_TOKEN`: enter it on the GM session screen under **ADVANCED**. Reading packs stays open.

## Security notes

- **Cloudflare Access is the gate.** Nothing reaches the app without passing it.
  Do not add the hostname without the Access application, and do not port-forward 3100.
- `API_TOKEN` is set on the server, so writes to `/api/content`, `/api/generate`,
  `/api/recap`, `/api/portrait`, `/api/tts`, `/api/gm` need the `x-api-token` header.
- The GM seat is protected by the GM PIN (5 wrong tries → 60 s lockout per game).
- LAN-only assumptions in the code worth reviewing now that it is internet-facing:
  - CORS is `origin: '*'` on both Express (`cors()`) and Socket.io. Access cookies
    limit who can actually connect, but a tighter origin (`https://muthur.kys-media.com`) would be cleaner.
  - No per-IP rate limiting on HTTP or socket events (behind Cloudflare every
    request also arrives from cloudflared's IP, so per-IP limits would need `CF-Connecting-IP`).
  - Room traffic is encrypted only between the browser and Cloudflare's edge;
    tunnel → CT 110 → CT 107 is plain HTTP on the home LAN. Nothing is end-to-end encrypted.
  - Anyone already past Access who knows a room code can open that room (as on the LAN).
  - AI GM / TTS / portrait calls use the GPU on sr650; `MAX_GAMES=200` caps games, not GPU load.

## Updating

On the server (from any directory):

```bash
ssh -i ~/.ssh/proxmox root@192.168.1.254
pct exec 107 -- /opt/muthur/update.sh
```

It fast-forwards `/opt/muthur` to the latest `expandable-system`, runs `npm ci`
and `npm run build`, restarts `muthur`, health-checks `/` plus
`/api/{tts,gm,portrait}/status`, and prints the git short hash. It never touches
`.env` or `/models/muthur/data`, and it is safe to run repeatedly. Overrides:
`MUTHUR_BRANCH`, `MUTHUR_DIR`, `MUTHUR_PORT`. (Only pushed commits are deployed: push first.)

When a new release needs a new env var, edit `/opt/muthur/web app/.env` and
`systemctl restart muthur`.

## Logs and status

```bash
pct exec 107 -- journalctl -u muthur -f          # live log
pct exec 107 -- systemctl status muthur
pct exec 107 -- curl -s localhost:3100/api/portrait/status
```

## Local LAN alternative

`scripts/deploy-local.ps1` still builds and runs the app on the Windows desktop
(default port 3100 on that machine, data in `..\aliens-deploy`). The two deploys
are separate machines with separate data: games made on one do not exist on the
other. They can run at the same time; the domain always points at CT 107.
