# FULL ECAS EXE analysis - find all SQL related to permissions + spy detection
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
$out = 'd:\almham\imports\full-analysis.txt'

$lines = @()

# Extract wide text region around spy detection (0x17B000 - 0x17C500)
# Get ALL readable ASCII/Arabic strings in this region
$startChar = 0x17B000 / 2
$endChar = 0x17C800 / 2
Write-Host "Extracting code region around spy detection..." -ForegroundColor Cyan

$region = $uni.Substring($startChar, $endChar - $startChar)
$pattern = '[\u0020-\u007E\u0600-\u06FF]{8,}'
$regexMatches = [regex]::Matches($region, $pattern)

$lines += "=========================================="
$lines += " STRINGS IN REGION 0x17B000 - 0x17C800"
$lines += "=========================================="
foreach ($m in $regexMatches) {
    $absOffset = $startChar * 2 + $m.Index * 2
    $lines += "[0x$('{0:X}' -f $absOffset)] $($m.Value.Trim())"
}
$lines += ""

# Find all SQL queries referencing permission tables
$lines += "=========================================="
$lines += " SQL QUERIES ON PERMISSION TABLES"
$lines += "=========================================="
$permTables = @('UserPrivileg', 'FormRankUser', 'RankUser', 'RankWork', 'UserWorkBoundary', 'UserRestrictedSomeID', 'UserRestrictedFormTable', 'UserEvent', 'FormData', 'FormEvent')
foreach ($t in $permTables) {
    $startIdx = 0
    $hits = 0
    while (($idx = $uni.IndexOf($t, $startIdx)) -ge 0) {
        $hits++
        $ctxStart = [Math]::Max(0, $idx - 200)
        $ctxLen = [Math]::Min(400, $uni.Length - $ctxStart)
        $ctx = $uni.Substring($ctxStart, $ctxLen)
        $clean = ($ctx -replace '[\x00-\x08\x0E-\x1F]', ' ') -replace '\s{3,}', ' | '
        # Only show if has interesting SQL keywords
        if ($clean -match '(?i)(SELECT|INSERT|UPDATE|DELETE|COUNT|CHECKSUM)') {
            $lines += "[$t #$hits @ 0x$('{0:X}' -f $idx)]"
            $lines += "  $clean"
            $lines += ""
        }
        $startIdx = $idx + $t.Length
        if ($hits -ge 5) { break }
    }
}

$lines | Out-File $out -Encoding UTF8
Write-Host "Saved to $out ($($lines.Count) lines)"
