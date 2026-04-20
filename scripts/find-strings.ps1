# Extract readable strings from the MSSQLBAK file to see what's inside

$testFile = 'd:\almham\imports\decompressed\ECAS_MC_HSbOS DailayDB BackUp  -  19-04-2026  -  06.43 AM.bin'

Write-Host "Scanning for readable strings in: $testFile" -ForegroundColor Cyan
Write-Host ""

$bytes = [System.IO.File]::ReadAllBytes($testFile)
$size = $bytes.Length
Write-Host "File size: $([math]::Round($size/1MB,1)) MB"
Write-Host ""

# Extract ASCII strings of at least N characters
function Get-StringsFromBytes {
    param($data, $minLen = 6, $maxResults = 500)

    $strings = New-Object System.Collections.Generic.List[string]
    $current = New-Object System.Text.StringBuilder
    $currentStart = 0
    $isAscii = $false

    for ($i = 0; $i -lt $data.Length; $i++) {
        $b = $data[$i]
        if ($b -ge 32 -and $b -lt 127) {
            if ($current.Length -eq 0) { $currentStart = $i }
            [void]$current.Append([char]$b)
        } else {
            if ($current.Length -ge $minLen) {
                $str = "0x{0:X8}: {1}" -f $currentStart, $current.ToString()
                $strings.Add($str)
                if ($strings.Count -ge $maxResults) { return $strings }
            }
            [void]$current.Clear()
        }
    }
    if ($current.Length -ge $minLen) {
        $str = "0x{0:X8}: {1}" -f $currentStart, $current.ToString()
        $strings.Add($str)
    }
    return $strings
}

Write-Host "=== ASCII Strings (min 10 chars, first 200) ===" -ForegroundColor Yellow
$strings = Get-StringsFromBytes -data $bytes -minLen 10 -maxResults 200
$strings | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "=== Searching for keywords ===" -ForegroundColor Yellow

$keywords = @('Customer', 'Subscriber', 'Meter', 'Invoice', 'Payment', 'Reading', 'Bill',
              'SELECT', 'INSERT', 'CREATE', 'TABLE', 'DATABASE', 'User', 'Password',
              'dbo.', 'sys.', 'ECAS', 'DohmyhS', 'SbOS', 'GhS',
              'zlib', 'compress', 'encrypt', 'AES', 'RC4')

foreach ($kw in $keywords) {
    $kwBytes = [System.Text.Encoding]::ASCII.GetBytes($kw)
    $count = 0
    $firstOffset = -1
    for ($i = 0; $i -lt $bytes.Length - $kwBytes.Length; $i++) {
        $match = $true
        for ($j = 0; $j -lt $kwBytes.Length; $j++) {
            if ($bytes[$i + $j] -ne $kwBytes[$j]) { $match = $false; break }
        }
        if ($match) {
            $count++
            if ($firstOffset -lt 0) { $firstOffset = $i }
            if ($count -ge 3) { break }
        }
    }
    if ($count -gt 0) {
        Write-Host ("  {0,-20} found (first at 0x{1:X8})" -f $kw, $firstOffset) -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Searching for UTF-16 strings (common in SQL Server and Windows) ===" -ForegroundColor Yellow

function Find-Utf16 {
    param($data, $keyword)
    $kwBytes = [System.Text.Encoding]::Unicode.GetBytes($keyword)
    for ($i = 0; $i -lt [Math]::Min($data.Length - $kwBytes.Length, 50000000); $i++) {
        $match = $true
        for ($j = 0; $j -lt $kwBytes.Length; $j++) {
            if ($data[$i + $j] -ne $kwBytes[$j]) { $match = $false; break }
        }
        if ($match) {
            Write-Host ("  UTF16 '{0}' found at 0x{1:X8}" -f $keyword, $i) -ForegroundColor Green
            return $i
        }
    }
    return -1
}

Find-Utf16 $bytes "Customer" | Out-Null
Find-Utf16 $bytes "Meter" | Out-Null
Find-Utf16 $bytes "Invoice" | Out-Null
Find-Utf16 $bytes "dbo" | Out-Null
Find-Utf16 $bytes "ECAS" | Out-Null
Find-Utf16 $bytes "varchar" | Out-Null
Find-Utf16 $bytes "CREATE TABLE" | Out-Null
