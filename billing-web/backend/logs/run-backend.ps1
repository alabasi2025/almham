$ErrorActionPreference = 'Stop'
function Read-DotEnv($Path) {
  $map = @{}
  foreach ($line in Get-Content -Path $Path) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith('#')) { continue }
    $idx = $trim.IndexOf('=')
    if ($idx -lt 0) { continue }
    $key = $trim.Substring(0, $idx).Trim()
    $value = $trim.Substring($idx + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }
    $map[$key] = $value
  }
  return $map
}
Set-Location 'D:\almham\billing-web\backend'
$source = Read-DotEnv '..\..\backend\.env'
$url = [UriBuilder]$source['DATABASE_URL']
$url.Path = 'almham_billing_db'
$env:BILLING_DATABASE_URL = $url.Uri.AbsoluteUri
$env:BILLING_DEV_AUTH_DISABLED = 'true'
$env:BILLING_PORT = '3100'
npm run dev
