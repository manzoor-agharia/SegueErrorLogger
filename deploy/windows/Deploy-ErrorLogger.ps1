<#
.SYNOPSIS
    Deploys the ErrorLogger backend (FastAPI) + frontend (Angular, served as static files by the
    backend) to this Windows VM as the "ErrorLogger" Windows Service, bound to port 3012.

.DESCRIPTION
    Mirrors backend/ code into the deploy root (never touching venv/, .env, or attachments/ --
    those persist across deploys), copies the built frontend into backend/app/static, ensures the
    venv exists and has current dependencies, runs Alembic migrations, then (re)installs the NSSM
    service and health-checks it.

.PARAMETER ArtifactPath
    Path to the extracted publish artifact. Must contain backend/ and frontend-static/ subfolders.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [string]$DeployRoot = "C:\Deploy\ErrorLogger",

    [int]$Port = 3012,

    [string]$ServiceName = "ErrorLogger",

    [int]$HealthCheckRetries = 10,
    [int]$HealthCheckDelaySeconds = 3
)

$ErrorActionPreference = "Stop"

$backendSrc = Join-Path $ArtifactPath "backend"
$frontendSrc = Join-Path $ArtifactPath "frontend-static"
if (-not (Test-Path $backendSrc)) { throw "Artifact missing backend/ folder at $backendSrc" }
if (-not (Test-Path $frontendSrc)) { throw "Artifact missing frontend-static/ folder at $frontendSrc" }

$backendDir = Join-Path $DeployRoot "backend"
$venvDir = Join-Path $backendDir "venv"
$staticDir = Join-Path $backendDir "app\static"
$envFile = Join-Path $backendDir ".env"

New-Item -ItemType Directory -Force -Path $backendDir | Out-Null

Write-Host "== Stopping service (if running) =="
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}

Write-Host "== Mirroring backend code (preserving venv/.env/attachments/static) =="
robocopy $backendSrc $backendDir /MIR /XD venv attachments static /XF .env | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host "== Deploying frontend static build =="
New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
robocopy $frontendSrc $staticDir /MIR | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy (static) failed with exit code $LASTEXITCODE" }

if (-not (Test-Path $envFile)) {
    throw ".env not found at $envFile -- create it on the VM before first deploy (DATABASE_URL, JWT_SECRET, CORS_ORIGINS=https://segue.pegasusone.com:$Port). CI never writes this file."
}

Write-Host "== Ensuring venv + dependencies =="
if (-not (Test-Path $venvDir)) {
    py -3.11 -m venv $venvDir
}
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r (Join-Path $backendDir "requirements.txt")

Write-Host "== Running Alembic migrations =="
Push-Location $backendDir
try {
    & $pythonExe -m alembic upgrade head
} finally {
    Pop-Location
}

Write-Host "== Seeding lookup data (screens) =="
Push-Location $backendDir
try {
    & $pythonExe -m app.seed_screens
} finally {
    Pop-Location
}

Write-Host "== Installing/updating Windows Service via NSSM =="
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) { throw "nssm not found on PATH -- install NSSM on this VM first (see deploy/windows/README.md)." }

$serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $serviceExists) {
    & $nssm install $ServiceName $pythonExe "-m uvicorn app.main:app --host 0.0.0.0 --port $Port"
    & $nssm set $ServiceName AppDirectory $backendDir
    & $nssm set $ServiceName DisplayName "ErrorLogger API"
    & $nssm set $ServiceName Start SERVICE_AUTO_START
} else {
    & $nssm set $ServiceName Application $pythonExe
    & $nssm set $ServiceName AppParameters "-m uvicorn app.main:app --host 0.0.0.0 --port $Port"
    & $nssm set $ServiceName AppDirectory $backendDir
}

Write-Host "== Starting service =="
Start-Service -Name $ServiceName

Write-Host "== Health check (http://127.0.0.1:$Port/) =="
$healthy = $false
for ($i = 1; $i -le $HealthCheckRetries; $i++) {
    Start-Sleep -Seconds $HealthCheckDelaySeconds
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
        Write-Host "  attempt $i/$HealthCheckRetries -- not up yet ($($_.Exception.Message))"
    }
}

if (-not $healthy) {
    Write-Host "== Service did not become healthy -- recent state: =="
    Get-Service -Name $ServiceName | Format-Table | Out-String | Write-Host
    throw "Deploy failed: $ServiceName did not respond on port $Port after $HealthCheckRetries retries."
}

Write-Host "== Deploy succeeded: $ServiceName is healthy on port $Port =="
