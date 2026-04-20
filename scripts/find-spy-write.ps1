# Find what the app WRITES when spy is detected
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Look at wider region around spy message (0x2F5000 - 0x2F9000)
Write-Host "=== Wider context around 'كشف عملية تجسس2' (0x2F7580) ===" -ForegroundColor Cyan
$regBytes = $bytes[0x2F5000..0x2F8FFF]
$regText = [System.Text.Encoding]::Unicode.GetString($regBytes)

# Match readable strings
$pattern = "[\u0020-\u007E\u0600-\u06FF]{6,}"
$regexMatches = [regex]::Matches($regText, $pattern)
$lines = @()
foreach ($m in $regexMatches) {
    $abs = 0x2F5000 + $m.Index * 2
    $v = $m.Value.Trim()
    if ($v.Length -ge 6) {
        $lines += "[0x$('{0:X}' -f $abs)] $v"
    }
}
$lines | Out-File 'd:\almham\imports\spy-wide.txt' -Encoding UTF8
Write-Host "Found $($lines.Count) strings, saved to spy-wide.txt"

# Look specifically for UPDATE/INSERT/DELETE that might write spy flag
Write-Host ""
Write-Host "=== Write operations near spy message ===" -ForegroundColor Yellow
foreach ($l in $lines) {
    if ($l -match "(?i)(UPDATE|INSERT|DELETE|SET\s|CreateScpTmpRec|BrnAlert|SpyAlert|Violation)") {
        Write-Host $l -ForegroundColor Green
    }
}
