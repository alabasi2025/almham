# Find where SumFrmID is computed
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Search SumFrmID and get all contexts
$startIdx = 0
$hits = 0
while (($idx = $uni.IndexOf('SumFrmID', $startIdx)) -ge 0) {
    $hits++
    $ctxStart = [Math]::Max(0, $idx - 500)
    $ctxLen = [Math]::Min(1200, $uni.Length - $ctxStart)
    $ctx = $uni.Substring($ctxStart, $ctxLen)

    # Extract printable chunks
    $pattern = '[\u0020-\u007E\u0600-\u06FF]{5,}'
    $chunks = [regex]::Matches($ctx, $pattern)
    Write-Host "`n=== SumFrmID #$hits at 0x$('{0:X}' -f ($idx*2)) ===" -ForegroundColor Yellow
    foreach ($c in $chunks) {
        if ($c.Value.Length -ge 5) {
            Write-Host "  $($c.Value)"
        }
    }

    $startIdx = $idx + 8
    if ($hits -ge 10) { break }
}
Write-Host "`nTotal SumFrmID occurrences: $hits"
