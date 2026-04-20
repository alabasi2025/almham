# Find spy detection logic in ECAS EXE
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Search for Arabic spy text
$terms = @('spy', 'hack', 'tamper', 'noal', 'DB_PassWord', 'HardDisk', 'Detect', 'Alert')
foreach ($t in $terms) {
    $idx = $uni.IndexOf($t)
    if ($idx -ge 0) {
        $start = [Math]::Max(0, $idx - 300)
        $len = [Math]::Min(700, $uni.Length - $start)
        $context = $uni.Substring($start, $len)
        # Clean non-printable
        $clean = $context -replace '[^\x20-\x7E\u0600-\u06FF\u0000-\u001F]', '?'
        $clean = $clean -replace '\x00+', ' '
        Write-Host "=== '$t' at offset $idx ===" -ForegroundColor Yellow
        Write-Host $clean.Substring(0, [Math]::Min(500, $clean.Length))
        Write-Host ""
    }
}
