# Find EXACT SQL in CheckUserPrivileg function
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# CheckUserPrivileg is at 0x17BC58. Look at wide context around it
Write-Host "=== Strings around CheckUserPrivileg (0x17BC58) ===" -ForegroundColor Cyan

# Look at all readable strings in region 0x178000 - 0x17D000
$regionBytes = $bytes[0x178000..0x17CFFF]
$regionText = [System.Text.Encoding]::Unicode.GetString($regionBytes)

# Filter SQL-related strings
$pattern = 'SELECT[\u0020-\u007E]{10,}|UPDATE[\u0020-\u007E]{10,}|DELETE[\u0020-\u007E]{10,}|INSERT[\u0020-\u007E]{10,}|UserPrivileg[\u0020-\u007E]{5,}|FormRankUser[\u0020-\u007E]{5,}|CheckUser[\u0020-\u007E]{0,100}'
$regexMatches = [regex]::Matches($regionText, $pattern)

$lines = @()
foreach ($m in $regexMatches) {
    $abs = 0x178000 + $m.Index * 2
    $lines += "[0x$('{0:X}' -f $abs)] $($m.Value)"
}
$lines | Out-File 'd:\almham\imports\check-user-sql.txt' -Encoding UTF8
Write-Host "Found $($lines.Count) SQL strings in region 0x178000-0x17D000"

# Search specifically for CheckUserPrivileg context
$idx = $uni.IndexOf('CheckUserPrivileg')
if ($idx -gt 0) {
    Write-Host ""
    Write-Host "CheckUserPrivileg found at 0x$('{0:X}' -f $idx)" -ForegroundColor Yellow

    # Get wide context before and after this function name
    $ctxStart = [Math]::Max(0, $idx - 800)
    $ctxLen = [Math]::Min(1600, $uni.Length - $ctxStart)
    $ctx = $uni.Substring($ctxStart, $ctxLen)

    # Extract all readable chunks
    $chunkPattern = '[\u0020-\u007E\u0600-\u06FF]{6,}'
    $chunks = [regex]::Matches($ctx, $chunkPattern)
    Write-Host "  Chunks near function: $($chunks.Count)"
    foreach ($c in $chunks) {
        $abs = ($ctxStart + $c.Index) * 2
        if ($c.Value.Length -ge 6) {
            Write-Host "  [0x$('{0:X}' -f $abs)] $($c.Value)" -ForegroundColor Gray
        }
    }
}
