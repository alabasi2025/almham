# Find files modified in the last 3 hours on the server
$h3 = (Get-Date).AddHours(-3)
Write-Output "Looking for files changed after $h3"

$dirs = @(
    'C:\Program Files (x86)\Electricity Customers Accounts System',
    'C:\Users\Mohammed\AppData\Local',
    'C:\Users\Mohammed\AppData\Roaming',
    'C:\Users\Mohammed\Documents',
    'C:\ProgramData'
)

foreach ($d in $dirs) {
    if (Test-Path $d) {
        Write-Output ""
        Write-Output "=== $d ==="
        Get-ChildItem $d -Recurse -Force -File -EA SilentlyContinue | Where-Object { $_.LastWriteTime -gt $h3 } | Select-Object -First 20 | ForEach-Object {
            Write-Output "  $($_.LastWriteTime.ToString('HH:mm:ss'))  $($_.FullName)"
        }
    }
}
