# Check SQL Server setup logs
$logDirs = @(
    'C:\Program Files\Microsoft SQL Server\160\Setup Bootstrap\Log',
    'C:\Program Files\Microsoft SQL Server\150\Setup Bootstrap\Log',
    'C:\Program Files\Microsoft SQL Server\120\Setup Bootstrap\Log'
)
foreach ($d in $logDirs) {
    if (Test-Path $d) {
        $latest = Get-ChildItem $d -Filter 'Summary*.txt' -Recurse -EA SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) {
            Write-Host "=== $($latest.FullName) ===" -ForegroundColor Cyan
            Get-Content $latest.FullName -Tail 40
        }
    }
}
