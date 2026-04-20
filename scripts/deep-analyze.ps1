# Deep analysis of the MSSQLBAK format

$f = 'd:\almham\imports\decompressed\ECAS_MC_HSbOS DailayDB BackUp  -  19-04-2026  -  06.43 AM.bin'
$bytes = [System.IO.File]::ReadAllBytes($f)
Write-Host "File: $f"
Write-Host "Size: $($bytes.Length) bytes"
Write-Host ""

# Search for SQL Server magic "TAPE" ANYWHERE in the file
Write-Host "=== Searching for TAPE marker in ENTIRE file ===" -ForegroundColor Cyan
$tape = [byte[]](0x54, 0x41, 0x50, 0x45)
$count = 0
for ($i = 0; $i -lt $bytes.Length - 4; $i++) {
    if ($bytes[$i] -eq 0x54 -and $bytes[$i+1] -eq 0x41 -and $bytes[$i+2] -eq 0x50 -and $bytes[$i+3] -eq 0x45) {
        $count++
        if ($count -le 5) { Write-Host ("  Found at offset 0x" + $i.ToString('X')) }
    }
}
Write-Host "Total TAPE occurrences: $count"

# Check byte value distribution
Write-Host ""
Write-Host "=== Byte value distribution (skip first 256) ===" -ForegroundColor Cyan
$counts = New-Object 'int[]' 256
$sampleSize = [Math]::Min(1000000, $bytes.Length - 256)
for ($i = 256; $i -lt 256 + $sampleSize; $i++) {
    $counts[$bytes[$i]]++
}
# Show top 15 most common bytes
$pairs = @()
for ($i = 0; $i -lt 256; $i++) {
    if ($counts[$i] -gt 0) {
        $pairs += [PSCustomObject]@{Byte=$i; Hex=$i.ToString('X2'); Count=$counts[$i]; Percent=[math]::Round($counts[$i]/$sampleSize*100,2)}
    }
}
$pairs | Sort-Object Count -Descending | Select-Object -First 15 | Format-Table -AutoSize | Out-String | Write-Host

# Check if data could be XOR'd with single byte
Write-Host ""
Write-Host "=== XOR single-byte check ===" -ForegroundColor Cyan
Write-Host "If XOR'd, most common byte XOR'd with key should give 0x00"
$mostCommonByte = ($pairs | Sort-Object Count -Descending | Select-Object -First 1).Byte
Write-Host "Most common byte: 0x$('{0:X2}' -f $mostCommonByte) - potential XOR key"

# Try different fixed offsets to find SQL backup
Write-Host ""
Write-Host "=== Checking fixed offsets for SQL backup signatures ===" -ForegroundColor Cyan
$testOffsets = @(16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 65536)
foreach ($off in $testOffsets) {
    if ($off -lt $bytes.Length - 16) {
        $slice = $bytes[$off..($off+15)]
        $hex = ($slice | ForEach-Object { $_.ToString('X2') }) -join ' '
        $ascii = -join ($slice | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } })
        Write-Host ("  Offset 0x{0,-6:X}: {1}  {2}" -f $off, $hex, $ascii)
    }
}

# Look at END of file too
Write-Host ""
Write-Host "=== Last 128 bytes ===" -ForegroundColor Cyan
$endStart = $bytes.Length - 128
for ($row = 0; $row -lt 8; $row++) {
    $off = $endStart + $row * 16
    $slice = $bytes[$off..($off+15)]
    $hex = ($slice | ForEach-Object { $_.ToString('X2') }) -join ' '
    $ascii = -join ($slice | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } })
    Write-Host ("  0x{0,-8:X}: {1}  {2}" -f $off, $hex, $ascii)
}

# Show offsets of printable ASCII strings >= 16 chars
Write-Host ""
Write-Host "=== First 20 ASCII strings (>=20 chars) ===" -ForegroundColor Cyan
$current = New-Object System.Text.StringBuilder
$startOff = 0
$found = 0
for ($i = 0; $i -lt $bytes.Length -and $found -lt 20; $i++) {
    $b = $bytes[$i]
    if ($b -ge 32 -and $b -lt 127) {
        if ($current.Length -eq 0) { $startOff = $i }
        [void]$current.Append([char]$b)
    } else {
        if ($current.Length -ge 20) {
            Write-Host ("  0x{0,-8:X}: {1}" -f $startOff, $current.ToString())
            $found++
        }
        [void]$current.Clear()
    }
}
