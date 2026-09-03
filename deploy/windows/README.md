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

## 7. TLS — IIS + Application Request Routing (ARR) reverse proxy

`uvicorn` only ever binds to `127.0.0.1:13012` (plain HTTP, not reachable from outside this
machine -- see `Deploy-ErrorLogger.ps1`'s `-InternalPort`). Public HTTPS on
`https://segue.pegasusone.com:3012` is terminated by IIS, reusing the certificate already bound to
this hostname for the `ECW_POC` site (port 9003), and reverse-proxied to the internal port via ARR.
This avoids ever exporting the certificate's private key.

**One-time setup** (this VM already has IIS/W3SVC and the URL Rewrite module; ARR is the only
missing piece):

```powershell
# 1. Install ARR (URL Rewrite must already be present -- it is on this box)
Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/?LinkID=615136" -OutFile C:\Windows\Temp\ARRv3.msi
Start-Process msiexec.exe -ArgumentList "/i C:\Windows\Temp\ARRv3.msi /qn /norestart" -Wait

# 2. Enable ARR's proxy feature (off by default -- installing ARR alone does not proxy anything)
Import-Module WebAdministration
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"

# 3. Create a dedicated site for the reverse-proxy binding
New-Item -ItemType Directory -Force -Path "C:\inetpub\wwwroot\ErrorLoggerProxy" | Out-Null
New-Website -Name "ErrorLoggerProxy" -PhysicalPath "C:\inetpub\wwwroot\ErrorLoggerProxy" -Port 3012 -HostHeader "segue.pegasusone.com" -Ssl

# 4. Attach the existing segue.pegasusone.com certificate via SNI (find the thumbprint with
#    Get-ChildItem -Path Cert:\LocalMachine -Recurse | Where-Object DnsNameList -match 'segue' --
#    on this VM it lives in the WebHosting store, not the usual My store)
$binding = Get-WebBinding -Name "ErrorLoggerProxy" -Protocol https
$binding.AddSslCertificate("<THUMBPRINT>", "WebHosting")

# 5. Add the reverse-proxy rule (URL Rewrite "Rewrite" action to a full URL is what triggers ARR)
@'
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToErrorLogger" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:13012/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
'@ | Set-Content -Encoding utf8 "C:\inetpub\wwwroot\ErrorLoggerProxy\web.config"
```

Installing ARR modifies IIS's central config, which can briefly recycle app pools for other
IIS-hosted sites on this box (there's only one running today: `ECW_POC`). It has no effect on
anything not hosted in IIS (which is everything else on this VM, including ErrorLogger itself).

---

Once all of the above is done, `git push origin main` (or Actions tab → Deploy → Run workflow)
builds the Angular frontend + stages the backend, ships it to the runner, and
`Deploy-ErrorLogger.ps1` installs/updates the `ErrorLogger` Windows Service (bound to
`127.0.0.1:13012`) and health-checks it there. The public site is
`https://segue.pegasusone.com:3012`, fronted by IIS/ARR.
