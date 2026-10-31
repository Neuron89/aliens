# Play-testing MU/TH/UR at home

Thanks for testing! One command installs the game terminal on your computer. Your computer
then acts as the "server": the GM screen runs on it (or on a tablet), a TV shows the board,
and everyone joins from their phone over your Wi-Fi.

## Install

**Windows**: open **PowerShell** (Start menu, type "PowerShell") and paste:

```powershell
irm https://raw.githubusercontent.com/Neuron89/aliens/expandable-system/install.ps1 | iex
```

**Mac or Linux**: open **Terminal** and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/Neuron89/aliens/expandable-system/install.sh | bash
```

No admin rights needed. It takes a few minutes the first time.

## What it does

1. Checks for **Node.js** 20 or newer. If it is missing it tries to install it (Windows: `winget`,
   Mac: Homebrew, Linux: apt). If that is not possible it tells you to get the **LTS** version from
   <https://nodejs.org/en/download>; install it, open a new window, and paste the command again.
2. Downloads the game, installs its packages and builds it.
3. Puts it in **`%LOCALAPPDATA%\MUTHUR`** (Windows) or **`~/muthur`** (Mac/Linux).
4. Adds start/stop launchers (and a **MUTHUR** shortcut on the Windows Desktop).
5. Starts the game and opens it in your browser.

## Start and stop

| | Windows | Mac / Linux |
|---|---|---|
| Start | double-click **MUTHUR** on the Desktop (or `Start MUTHUR.cmd` in the install folder) | `~/muthur/start.sh` (Mac: or double-click `Start MUTHUR.command`) |
| Stop | `Stop MUTHUR.cmd` in the install folder | `~/muthur/stop.sh` |

The game keeps running in the background until you stop it or restart the computer.
Closing the start window does not stop it.

## Joining from phones and the TV

When it starts, the window prints addresses like:

```
GM (this computer) : http://localhost:3100
GM (tablet)        : http://192.168.1.20:3100
TV / table screen  : http://192.168.1.20:3100/tv
Players' phones    : http://192.168.1.20:3100  -> JOIN -> type the code the GM screen shows
```

- The **GM** starts a session on the GM screen; it shows a short **code**.
- **Players** open the phone address in their browser, tap **JOIN** and type the code.
- The **TV** opens the `/tv` address and types the same code.
- Every device must be on the **same Wi-Fi** as the computer. Guest Wi-Fi networks usually block
  this; use the main network.

## Phones can't connect? (firewall)

- **Windows**: double-click **`Allow Phones (Firewall).cmd`** in the install folder and click Yes
  on the prompt. It opens the game's port (3100) once. If Windows ever asked about "Node.js" and
  you clicked Cancel, this may still be blocked: open "Windows Defender Firewall > Allow an app",
  find Node.js and tick both boxes.
- **Mac**: if asked whether "node" may accept incoming connections, click **Allow**.
- **Linux** with ufw: `sudo ufw allow 3100/tcp`.

## Your saved games

Saved sessions, portraits and imported scenario packs live in the **`data`** folder inside the
install folder. Updating never touches it. Copy that folder to back it up.

## Update

Paste the same install command again. It stops the game, downloads the newest version,
rebuilds and starts it. Your `data` folder is kept.

## Uninstall

Stop the game, then delete the install folder (`%LOCALAPPDATA%\MUTHUR` or `~/muthur`) and,
on Windows, the **MUTHUR** Desktop shortcut. That's everything (Node.js stays installed; remove it
like any other program if you want).

## Extras (optional)

- Different port: set `MUTHUR_PORT` before installing/starting (PowerShell: `$env:MUTHUR_PORT=3200`,
  Terminal: `export MUTHUR_PORT=3200`).
- Different folder: set `MUTHUR_HOME` the same way.
- Logs (send them along with bug reports): the `logs` folder in the install folder.
