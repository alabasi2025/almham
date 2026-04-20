# Analyze the MSSQLBAK-wrapped format to find the real SQL Server backup inside

$testFile = 'd:\almham\imports\decompressed\ECAS_MC_HSbOS DailayDB BackUp  -  19-04-2026  -  06.43 AM.bin'

Write-Host "Analyzing: $testFile" -ForegroundColor Cyan
$fi = Get-Item $testFile
Write-Host ("Total size: " + $fi.Length + " bytes (" + [math]::Round($fi.Length/1MB,1) + " MB)")
Write-Host ""

$bytes = [System.IO.File]::ReadAllBytes($testFile)

# Parse MSSQLBAK header
Write-Host "=== MSSQLBAK Header Analysis ===" -ForegroundColor Yellow
Write-Host ("Magic (8 bytes): " + [System.Text.Encoding]::ASCII.GetString($bytes[0..7]))
Write-Host ("Field at offset 8 (4 bytes UInt32 LE): " + [BitConverter]::ToUInt32($bytes, 8))
Write-Host ("Field at offset 12 (4 bytes UInt32 LE): " + [BitConverter]::ToUInt32($bytes, 12))
Write-Host ("Field at offset 16 (4 bytes UInt32 LE): " + [BitConverter]::ToUInt32($bytes, 16))
Write-Host ("Field at offset 20 (4 bytes UInt32 LE): " + [BitConverter]::ToUInt32($bytes, 20))
Write-Host ("Field at offset 24 (8 bytes UInt64 LE): " + [BitConverter]::ToUInt64($bytes, 24))
Write-Host ""

# Search for known SQL Server backup markers
Write-Host "=== Searching for SQL Backup markers ===" -ForegroundColor Yellow

# TAPE marker (0x54415045) - Microsoft Tape Format used by SQL Server backups
$tapeMarker = [byte[]](0x54, 0x41, 0x50, 0x45)  # TAPE
$sidsMarker = [byte[]](0x53, 0x49, 0x44, 0x53)  # SIDS
$spadMarker = [byte[]](0x53, 0x50, 0x41, 0x44)  # SPAD
$mqdaMarker = [byte[]](0x4D, 0x51, 0x44, 0x41)  # MQDA

function Find-Pattern {
    param($data, $pattern, $label, $maxResults = 5)
    $count = 0
    for ($i = 0; $i -lt [Math]::Min($data.Length - $pattern.Length, 10000000); $i++) {
        $match = $true
        for ($j = 0; $j -lt $pattern.Length; $j++) {
            if ($data[$i + $j] -ne $pattern[$j]) { $match = $false; break }
        }
        if ($match) {
            Write-Host ("  " + $label + " found at offset: 0x" + $i.ToString('X8') + " (" + $i + ")")
            $count++
            if ($count -ge $maxResults) { break }
        }
    }
    if ($count -eq 0) { Write-Host ("  " + $label + ": NOT FOUND in first 10MB") }
}

Find-Pattern $bytes $tapeMarker "TAPE"
Find-Pattern $bytes $sidsMarker "SIDS"
Find-Pattern $bytes $spadMarker "SPAD"
Find-Pattern $bytes $mqdaMarker "MQDA"

Write-Host ""
Write-Host "=== Raw bytes from offset 0 to 256 ===" -ForegroundColor Yellow
for ($row = 0; $row -lt 16; $row++) {
    $line = "{0:X4}: " -f ($row * 16)
    $hex = ""
    $ascii = ""
    for ($col = 0; $col -lt 16; $col++) {
        $b = $bytes[$row * 16 + $col]
        $hex += $b.ToString('X2') + " "
        if ($b -ge 32 -and $b -lt 127) { $ascii += [char]$b } else { $ascii += "." }
    }
    Write-Host ($line + $hex + "  " + $ascii)
}

Write-Host ""
Write-Host "=== Raw bytes from offset 512 to 768 ===" -ForegroundColor Yellow
for ($row = 32; $row -lt 48; $row++) {
    $line = "{0:X4}: " -f ($row * 16)
    $hex = ""
    $ascii = ""
    for ($col = 0; $col -lt 16; $col++) {
        $b = $bytes[$row * 16 + $col]
        $hex += $b.ToString('X2') + " "
        if ($b -ge 32 -and $b -lt 127) { $ascii += [char]$b } else { $ascii += "." }
    }
    Write-Host ($line + $hex + "  " + $ascii)
}
