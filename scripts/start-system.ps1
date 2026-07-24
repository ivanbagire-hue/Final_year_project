[CmdletBinding()]
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$MinimumNodeVersion = [version]'22.5.0'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerFile = Join-Path $ProjectRoot 'server.js'

function Stop-WithMessage {
    param([string]$Message)
    Write-Host ''
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Get-CompatibleNode {
    $candidates = @()
    $pathCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($pathCommand) {
        $candidates += $pathCommand.Source
    }
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    }
    if (${env:ProgramFiles(x86)}) {
        $candidates += (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
    }
    if ($env:LOCALAPPDATA) {
        $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate)) {
            continue
        }
        try {
            $versionText = (& $candidate --version 2>$null).TrimStart('v')
            $version = [version]$versionText
            if ($version -ge $MinimumNodeVersion) {
                return [pscustomobject]@{
                    Path = $candidate
                    Version = $version
                }
            }
        } catch {
            # Continue checking other known installation locations.
        }
    }
    return $null
}

function Install-NodeLts {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        Stop-WithMessage @'
Node.js 22.5 or newer is required, and Windows Package Manager (winget) is not
available. Install the current Node.js LTS release from https://nodejs.org and
run start-system.cmd again.
'@
    }

    Write-Host 'Node.js 22.5+ was not found.' -ForegroundColor Yellow
    Write-Host 'Installing the current Node.js LTS release with winget...'

    & $winget.Source install `
        --id OpenJS.NodeJS.LTS `
        --exact `
        --accept-source-agreements `
        --accept-package-agreements `
        --silent

    if ($LASTEXITCODE -ne 0) {
        Write-Host 'The normal installation did not complete; trying an upgrade/repair...' -ForegroundColor Yellow
        & $winget.Source upgrade `
            --id OpenJS.NodeJS.LTS `
            --exact `
            --accept-source-agreements `
            --accept-package-agreements `
            --silent
    }
}

function Test-ManicsServer {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri 'http://127.0.0.1:3000/api/session' `
            -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Host 'Manics Partnership Management System' -ForegroundColor Cyan
Write-Host 'Checking required runtime...'

$node = Get-CompatibleNode
if (-not $node) {
    Install-NodeLts
    $node = Get-CompatibleNode
}

if (-not $node) {
    Stop-WithMessage @'
Node.js installation could not be verified. Restart Windows if an installer
requested it, then run start-system.cmd again.
'@
}

Write-Host "Node.js $($node.Version) found at $($node.Path)" -ForegroundColor Green

& $node.Path -e "require('node:sqlite')" 2>$null
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'This Node.js installation does not include the required built-in SQLite module.'
}

if (-not (Test-Path -LiteralPath $ServerFile)) {
    Stop-WithMessage "server.js was not found in $ProjectRoot."
}

if ($CheckOnly) {
    Write-Host 'Dependency check completed successfully.' -ForegroundColor Green
    exit 0
}

if (Test-ManicsServer) {
    Write-Host ''
    Write-Host 'The application is already running:' -ForegroundColor Green
    Write-Host 'http://localhost:3000'
    exit 0
}

Set-Location -LiteralPath $ProjectRoot
Write-Host ''
Write-Host 'All required dependencies are available.' -ForegroundColor Green
Write-Host 'Starting the application at http://localhost:3000'
Write-Host 'Keep this window open. Press Ctrl+C to stop the server.' -ForegroundColor Yellow
Write-Host ''

& $node.Path $ServerFile
exit $LASTEXITCODE
