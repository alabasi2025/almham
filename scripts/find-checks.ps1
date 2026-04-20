# Find SQL CHECK conditions related to spy detection
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
$out = 'd:\almham\imports\spy-checks.txt'
$lines = @()

# Keywords that might be near the spy check logic
$terms = @('COUNT(DISTINCT', 'SELECT COUNT(*) FROM User', 'FROM UserPrivileg', 
           'FROM FormRankUser', 'Cst_LastArrears', 'TswBasicData', 'Dt_IsHandledFor',
           'Com_NoOfPeriodInMonth', 'AutoFix', 'RecomputeAll', 'ValidateUser',
           'CheckUser', 'SecurityCheck', 'CheckData', 'ValidPrivileg')

foreach ($t in $terms) {
    $startIdx = 0
    $hits = 0
    while (($idx = $uni.IndexOf($t, $startIdx, [StringComparison]::OrdinalIgnoreCase)) -ge 0) {
        $hits++
        $ctxStart = [Math]::Max(0, $idx - 100)
        $ctxLen = [Math]::Min(400, $uni.Length - $ctxStart)
        $ctx = $uni.Substring($ctxStart, $ctxLen)
        $clean = ($ctx -replace '[\x00-\x08\x0E-\x1F]', ' ') -replace '\s{3,}', ' | '
        $lines += "[$t #$hits @ 0x$('{0:X}' -f $idx)]: $clean"
        $startIdx = $idx + $t.Length
        if ($hits -ge 3) { break }
    }
}

$lines | Out-File $out -Encoding UTF8
Write-Host "Saved $($lines.Count) matches to $out"

# Also search specifically for FormData-related checks near the spy message
Write-Host ""
Write-Host "=== Strings near spy message offset 0x17B9EE ===" -ForegroundColor Cyan
# Scan region 0x17B000 to 0x17C500 for ANY strings including those with null separators
$bytesRegion = $bytes[0x17B000..0x17C4FF]
$regionText = [System.Text.Encoding]::Unicode.GetString($bytesRegion)
# Find all runs of printable chars length 8+
$pattern2 = '[\u0020-\u007E\u0600-\u06FF]{8,}'
$m2 = [regex]::Matches($regionText, $pattern2)
Write-Host "Found $($m2.Count) strings in region"
$lines2 = @()
foreach ($m in $m2) {
    $abs = 0x17B000 + $m.Index * 2
    $lines2 += "[0x$('{0:X}' -f $abs)] $($m.Value.Trim())"
}
$lines2 | Out-File 'd:\almham\imports\spy-region-strings.txt' -Encoding UTF8
