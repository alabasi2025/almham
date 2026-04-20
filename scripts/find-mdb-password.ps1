# Find Access .mDb password from ECAS EXE binary
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Find "Jet OLEDB:DATABASE PASSWORD =" and extract what follows
$marker = 'Jet OLEDB:DATABASE PASSWORD ='
$idx = $uni.IndexOf($marker)
if ($idx -ge 0) {
    $after = $uni.Substring($idx + $marker.Length, 200)
    # Extract until null or quote or semicolon
    $pw = ''
    foreach ($ch in $after.ToCharArray()) {
        if ($ch -eq [char]0 -or $ch -eq '"' -or $ch -eq "'" -or $ch -eq ';') { break }
        $pw += $ch
    }
    Write-Host "Found password after marker: '$pw'" -ForegroundColor Green
    Write-Host "Raw chars after marker:" -ForegroundColor Cyan
    $chars = $after.Substring(0, 50).ToCharArray()
    foreach ($c in $chars) {
        Write-Host ("  [{0}] = 0x{1:X4}" -f $c, [int]$c)
    }
} else {
    Write-Host "Marker not found in Unicode" -ForegroundColor Red
}

# Also search in ASCII
$ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
$idx2 = $ascii.IndexOf($marker)
if ($idx2 -ge 0) {
    $after2 = $ascii.Substring($idx2 + $marker.Length, 100)
    $pw2 = ''
    foreach ($ch in $after2.ToCharArray()) {
        if ([int]$ch -lt 32 -or $ch -eq '"' -or $ch -eq "'" -or $ch -eq ';') { break }
        $pw2 += $ch
    }
    Write-Host "`nASCII password: '$pw2'" -ForegroundColor Green
}
