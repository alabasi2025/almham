$files = Get-ChildItem 'd:\almham\M\*.dbf'
foreach ($f in $files) {
    Write-Host "`n=== $($f.Name) ===" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($f.Length/1MB,1)) MB"
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)[0..511]
    Write-Host "First 32 bytes HEX:"
    Write-Host (($bytes[0..31] | ForEach-Object { $_.ToString('X2') }) -join ' ')
    Write-Host ""
    Write-Host "Printable ASCII from first 512 bytes:"
    $ascii = ($bytes | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } }) -join ''
    Write-Host $ascii
}
