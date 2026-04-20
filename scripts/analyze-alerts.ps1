# Find ALL spy/alert messages and surrounding logic in ECAS EXE
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
$outFile = 'd:\almham\imports\alerts-analysis.txt'

$lines = @()

# Extract all Unicode strings of length 20+ that contain Arabic
$results = @()
$sb = New-Object System.Text.StringBuilder
$inString = $false

for ($i = 0; $i -lt $bytes.Length - 1; $i += 2) {
    $lo = $bytes[$i]
    $hi = $bytes[$i + 1]
    $ch = [int]($lo -bor ($hi -shl 8))

    # Check if printable char (ASCII printable OR Arabic range)
    $isPrintable = ($ch -ge 0x20 -and $ch -le 0x7E) -or ($ch -ge 0x0600 -and $ch -le 0x06FF) -or $ch -eq 0x0020
    $isArabic = ($ch -ge 0x0600 -and $ch -le 0x06FF)

    if ($isPrintable) {
        $sb.Append([char]$ch) | Out-Null
    } else {
        if ($sb.Length -ge 25) {
            $str = $sb.ToString()
            # Check if it has Arabic
            $hasArabic = [bool]([regex]::IsMatch($str, '[\u0600-\u06FF]'))
            if ($hasArabic) {
                $results += [PSCustomObject]@{Offset=$i; Length=$sb.Length; Text=$str}
            }
        }
        $sb.Clear() | Out-Null
    }
}

Write-Host "Found $($results.Count) Arabic strings"

# Save ALL Arabic strings - we'll filter in the file
foreach ($r in $results) {
    $lines += "--- Offset: 0x$('{0:X}' -f $r.Offset) (len=$($r.Length)) ---"
    $lines += $r.Text
    $lines += ""
}

$lines | Out-File $outFile -Encoding UTF8
Write-Host "Done. See $outFile"
