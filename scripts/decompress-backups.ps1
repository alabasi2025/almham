# Decompress gzipped backup files from d:\almham\M and inspect inner format
# (ASCII-only to avoid PowerShell 5.1 encoding issues)

$sourceDir = 'd:\almham\M'
$targetDir = 'd:\almham\imports\decompressed'

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$files = Get-ChildItem "$sourceDir\*.dbf"

foreach ($f in $files) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "FILE: $($f.Name)" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan

    $outName = $f.BaseName + '.bin'
    $outPath = Join-Path $targetDir $outName

    Write-Host "Decompressing to: $outPath" -ForegroundColor Gray

    try {
        $fs = [System.IO.File]::OpenRead($f.FullName)
        $gzip = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
        $out = [System.IO.File]::Create($outPath)
        $gzip.CopyTo($out)
        $out.Close()
        $gzip.Close()
        $fs.Close()

        $outFile = Get-Item $outPath
        Write-Host ("OK. Decompressed size: " + [math]::Round($outFile.Length/1MB,1) + " MB") -ForegroundColor Green

        # Inspect decompressed header
        $bytes = [System.IO.File]::ReadAllBytes($outPath)[0..511]
        Write-Host ""
        Write-Host "First 32 bytes HEX:" -ForegroundColor Yellow
        Write-Host (($bytes[0..31] | ForEach-Object { $_.ToString('X2') }) -join ' ')
        Write-Host ""
        Write-Host "Printable ASCII (first 512 bytes):" -ForegroundColor Yellow
        $ascii = -join ($bytes | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } })
        Write-Host $ascii

        # Try detect format
        $magic = ($bytes[0..7] | ForEach-Object { $_.ToString('X2') }) -join ' '
        Write-Host ""
        Write-Host "Format detection:" -ForegroundColor Magenta
        if ($magic -match '^54 41 50 45') {
            Write-Host "  -> SQL Server backup (.bak) - starts with TAPE" -ForegroundColor Green
        } elseif ($bytes[0] -eq 0x03 -or $bytes[0] -eq 0x83 -or $bytes[0] -eq 0xF5 -or $bytes[0] -eq 0x30) {
            Write-Host "  -> dBase/FoxPro .DBF file (version byte: $($bytes[0].ToString('X2')))" -ForegroundColor Green
        } elseif ($magic -match '^4D 5A') {
            Write-Host "  -> Windows EXE/DLL" -ForegroundColor Yellow
        } elseif ($bytes[0] -eq 0x1F -and $bytes[1] -eq 0x8B) {
            Write-Host "  -> Another GZIP (nested)" -ForegroundColor Yellow
        } elseif ($magic -match '^50 4B 03 04') {
            Write-Host "  -> ZIP archive" -ForegroundColor Yellow
        } else {
            Write-Host "  -> Unknown format. Magic: $magic" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Output folder: $targetDir" -ForegroundColor Cyan
