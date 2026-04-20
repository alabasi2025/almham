# Search for ECAS log files across the system
Write-Output "=== Log files in ECAS folder ==="
Get-ChildItem 'C:\Program Files (x86)\Electricity Customers Accounts System' -Recurse -Force -EA SilentlyContinue | Where-Object { $_.Extension -match '\.(log|txt|dat|bin|evt|trc|xml|ini|cfg)$' -or $_.Name -match 'log' } | Select-Object FullName, LastWriteTime, Length

Write-Output ""
Write-Output "=== ECAS-related files in common log locations ==="
$logPaths = @(
    "$env:PROGRAMDATA",
    "$env:APPDATA",
    "$env:LOCALAPPDATA",
    "C:\Windows\Temp",
    "C:\Temp",
    "C:\Logs",
    "C:\ECAS",
    "C:\Users\Mohammed\Documents",
    "C:\Users\Administrator\AppData\Roaming",
    "C:\Users\Administrator\AppData\Local",
    "C:\Users\Administrator\Documents"
)

foreach ($p in $logPaths) {
    if (Test-Path $p) {
        Get-ChildItem $p -Recurse -Force -EA SilentlyContinue -File -Depth 4 | Where-Object { 
            $_.Name -match '(?i)(ecas|electric|yemen|spy|tbu)' -or 
            ($_.Extension -match '\.(log|dat|bin)$' -and $_.LastWriteTime -gt (Get-Date).AddDays(-2))
        } | Select-Object -First 10 | ForEach-Object {
            Write-Output "  $($_.LastWriteTime.ToString('HH:mm')) $($_.Length.ToString().PadLeft(10)) $($_.FullName)"
        }
    }
}

Write-Output ""
Write-Output "=== Hidden files in ECAS folder ==="
Get-ChildItem 'C:\Program Files (x86)\Electricity Customers Accounts System' -Recurse -Force -File -EA SilentlyContinue | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::Hidden } | Select-Object FullName, Length, LastWriteTime
