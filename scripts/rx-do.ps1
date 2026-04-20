# Send contents of a local .ps1 script to the remote server and execute it there
# Usage: .\rx-do.ps1 path\to\script.ps1

param(
    [Parameter(Mandatory, Position = 0)]
    [string]$LocalScript,

    [string]$Server = '100.114.106.110',
    [int]$Port = 7777,
    [string]$Secret = 'AlhamCascade@2026',
    [int]$TimeoutSec = 60
)

if (-not (Test-Path $LocalScript)) {
    Write-Host "File not found: $LocalScript" -ForegroundColor Red
    exit 1
}

$content = Get-Content -Path $LocalScript -Raw -Encoding UTF8
$rx = Join-Path $PSScriptRoot 'rx.ps1'
& $rx -Server $Server -Port $Port -Secret $Secret -TimeoutSec $TimeoutSec $content
