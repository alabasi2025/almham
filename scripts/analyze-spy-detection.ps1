# Deep analysis of ECAS EXE spy detection mechanism - READ ONLY
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
$outFile = 'd:\almham\imports\spy-analysis.txt'
$lines = @()

# 1. Find ALL occurrences of key detection terms
$terms = @('Code09', 'Code08', 'noal', 'DB_PassWord', 'DB_SysEXEName', 'DB_Version', 
           'HardDisk', 'LoadHard', 'spy', 'Detect', 'Alert', 'Security',
           'UserEvent', 'EventDate', 'CheckSum', 'Hash',
           'nullandnotempty', 'Us_PassWord')

foreach ($t in $terms) {
    $startIdx = 0
    $count = 0
    while (($idx = $uni.IndexOf($t, $startIdx, [StringComparison]::OrdinalIgnoreCase)) -ge 0) {
        $count++
        $ctxStart = [Math]::Max(0, $idx - 500)
        $ctxLen = [Math]::Min(1200, $uni.Length - $ctxStart)
        $raw = $uni.Substring($ctxStart, $ctxLen)
        # Extract readable strings
        $clean = $raw -replace '[\x00-\x08\x0E-\x1F]', '|'
        $clean = $clean -replace '\|{2,}', ' ~ '
        $lines += "=== [$t] occurrence $count at offset $idx ==="
        $lines += $clean.Substring(0, [Math]::Min(800, $clean.Length))
        $lines += ""
        $startIdx = $idx + $t.Length
    }
}

# 2. Search for SQL queries that check integrity
$sqlPatterns = @('SELECT.*FROM.*DB_And_Sys_Info', 'SELECT.*FROM.*UserData.*WHERE', 
                 'SELECT.*FROM.*UserEvent', 'SELECT.*noal', 'CHECKSUM', 'HASHBYTES',
                 'COUNT\(\*\).*FROM.*UserEvent', 'SELECT.*FROM.*HardDisk')
foreach ($p in $sqlPatterns) {
    $matches = [regex]::Matches($uni, $p, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $matches) {
        $ctxStart = [Math]::Max(0, $m.Index - 200)
        $ctxLen = [Math]::Min(600, $uni.Length - $ctxStart)
        $raw = $uni.Substring($ctxStart, $ctxLen)
        $clean = $raw -replace '[\x00-\x08\x0E-\x1F]', '|'
        $clean = $clean -replace '\|{2,}', ' ~ '
        $lines += "=== SQL: [$p] at offset $($m.Index) ==="
        $lines += $clean.Substring(0, [Math]::Min(600, $clean.Length))
        $lines += ""
    }
}

$lines | Out-File $outFile -Encoding UTF8
Write-Host "Analysis saved to $outFile ($($lines.Count) lines)"
