# Check why ECAS won't start
Write-Host "=== Event Log Errors ===" -ForegroundColor Cyan
$events = Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2; StartTime=(Get-Date).AddMinutes(-5)} -MaxEvents 5 -EA SilentlyContinue
foreach ($e in $events) {
    $msg = $e.Message
    if ($msg.Length -gt 400) { $msg = $msg.Substring(0, 400) }
    Write-Host "[$($e.TimeCreated)] $msg"
    Write-Host ""
}

Write-Host "=== SideBySide Errors ===" -ForegroundColor Cyan
$events2 = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='SideBySide'; StartTime=(Get-Date).AddMinutes(-5)} -MaxEvents 3 -EA SilentlyContinue
foreach ($e in $events2) {
    $msg = $e.Message
    if ($msg.Length -gt 400) { $msg = $msg.Substring(0, 400) }
    Write-Host $msg
    Write-Host ""
}

Write-Host "=== Process check ===" -ForegroundColor Cyan
$p = Get-Process '*Electric*' -EA SilentlyContinue
if ($p) { Write-Host "Running: $($p.Name) PID=$($p.Id)" }
else { Write-Host "Not running" }
