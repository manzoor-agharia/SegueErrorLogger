# ErrorLogger deploy — one-time VM setup

Do this once, on the VM itself (`segue.pegasusone.com`), before the first `git push origin main`
triggers a deploy. All of it needs an interactive session on that machine — it can't be done
from this repo's CI or from a different machine.

## 1. Register a self-hosted Actions runner for *this* repo

Self-hosted runners are scoped per-repo on a personal GitHub account, so this repo needs its own
runner even though it's the same VM already running the FHIRBridge runner.

1. On GitHub: `SegueErrorLogger` repo → Settings → Actions → Runners → New self-hosted runner →
   Windows.
2. On the VM, in a **new folder** (don't reuse the FHIRBridge runner's folder — each runner is a
   separate service instance):
   ```powershell
   mkdir C:\actions-runner-errorlogger
   cd C:\actions-runner-errorlogger
   # follow the download/config commands GitHub shows you
   ./config.cmd --url https://github.com/manzoor-agharia/SegueErrorLogger --token <TOKEN> --labels segueerrorlogger-vm
   ./svc install
   ./svc start
   ```
   The `--labels segueerrorlogger-vm` must match `runs-on: [self-hosted, Windows, segueerrorlogger-vm]`
   in `.github/workflows/deploy.yml`.

## 2. Install NSSM

Used to run `uvicorn` as a Windows Service (there's no built-in `dotnet ... UseWindowsService()`
equivalent for a plain Python process).

```powershell
choco install nssm -y
# or download from https://nssm.cc/download and put nssm.exe on PATH
```

## 3. Install Python 3.11

Match what the dev venv was built with (`backend/venv/pyvenv.cfg` → `version = 3.11.9`):
```powershell
winget install Python.Python.3.11
```
Confirm `py -3.11` resolves on PATH — the deploy script uses it to create the venv on first run.

## 4. Provision Postgres for ErrorLogger

Either a new database on the existing SQL/Postgres instance the VM already runs for FHIRBridge, or
a separate one — your call. Note the connection string for step 5.

## 5. Create the production `.env` by hand

CI never writes this file (see `.gitignore` / the deploy script's `robocopy /XF .env`) so secrets
never round-trip through the artifact. Create it directly at
`C:\Deploy\ErrorLogger\backend\.env`:

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/ErrorLogger
JWT_SECRET=<generate a long random string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
ATTACHMENTS_DIR=./attachments
CORS_ORIGINS=https://segue.pegasusone.com:3012
```

The deploy script (`Deploy-ErrorLogger.ps1`) refuses to run if this file is missing.

## 6. Open the firewall port

```powershell
New-NetFirewallRule -DisplayName "ErrorLogger API" -Direction Inbound -LocalPort 3012 -Protocol TCP -Action Allow
```

## 7. TLS

`CORS_ORIGINS` above assumes `https://segue.pegasusone.com:3012`. If TLS isn't already terminated
for this port (the FHIRBridge Gateway/DemoApi certs are per-port), either extend the existing
cert/reverse-proxy setup to cover 3012, or have uvicorn terminate TLS directly
(`--ssl-keyfile`/`--ssl-certfile` — would need adding to the NSSM `AppParameters` in
`Deploy-ErrorLogger.ps1` if you go this route).

---

Once all of the above is done, `git push origin main` (or Actions tab → Deploy → Run workflow)
builds the Angular frontend + stages the backend, ships it to the runner, and
`Deploy-ErrorLogger.ps1` installs/updates the `ErrorLogger` Windows Service and health-checks it
on `http://127.0.0.1:3012/`.
