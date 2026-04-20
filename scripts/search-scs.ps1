# Search for 'Scs_Name' and related fields in EXE
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

$terms = @('Scs_Name', 'Scs_', '_PassWord', 'Cst_PassWord', 'DB_Safety', 'DB_Integrity', 'Safe_', 'nalert', 'NumOfAlert', 'SpyCount', 'DBAlert', 'BrnAlert')
foreach ($t in $terms) {
    $startIdx = 0
    $hits = 0
    while (($idx = $uni.IndexOf($t, $startIdx)) -ge 0) {
        $hits++
        $ctxStart = [Math]::Max(0, $idx - 100)
        $ctxLen = [Math]::Min(300, $uni.Length - $ctxStart)
        $raw = $uni.Substring($ctxStart, $ctxLen)
        $clean = $raw -replace '[\x00-\x08\x0E-\x1F]', ' '
        $clean = $clean -replace '\s{3,}', ' | '
        Write-Host "[$t #$hits] @ 0x$('{0:X}' -f $idx): $clean" -ForegroundColor $(if ($hits -eq 1) { 'Yellow' } else { 'Gray' })
        $startIdx = $idx + $t.Length
        if ($hits -ge 5) { break }
    }
    if ($hits -eq 0) { Write-Host "[$t] NOT FOUND" -ForegroundColor DarkGray }
}
