param(
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $root 'src\EcasLegacyBilling.Api\EcasLegacyBilling.Api.csproj'
$publishDir = Join-Path $root 'tauri-billing\src-tauri\binaries\api-publish'
$sidecarDir = Join-Path $root 'tauri-billing\src-tauri\binaries'
$sidecarPath = Join-Path $sidecarDir 'ecas-billing-api-x86_64-pc-windows-msvc.exe'

New-Item -ItemType Directory -Force -Path $publishDir, $sidecarDir | Out-Null

dotnet publish $apiProject `
    -c $Configuration `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:PublishReadyToRun=false `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $publishDir

Copy-Item -LiteralPath (Join-Path $publishDir 'EcasLegacyBilling.Api.exe') -Destination $sidecarPath -Force
Write-Host "Sidecar ready: $sidecarPath"
