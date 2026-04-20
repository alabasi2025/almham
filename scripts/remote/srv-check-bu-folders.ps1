$folders = @(
    "E:\ECAS.MC NewSabalieah Auto Backup",
    "E:\ECAS.MC Gholeeil Auto Backup",
    "E:\ECAS.MC Dohmyah Auto Backup"
)
foreach ($f in $folders) {
    Write-Host ("=== " + $f + " ===")
    if (Test-Path $f) {
        # List latest 5 .dbf files
        Get-ChildItem $f -Recurse -Filter "*.dbf" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 5 |
            ForEach-Object { Write-Host ("  " + $_.Name + " | " + [math]::Round($_.Length/1MB,1) + "MB | " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")) }
        # Test write permission
        try {
            "test" | Out-File (Join-Path $f "test_write.tmp")
            Remove-Item (Join-Path $f "test_write.tmp") -Force
            Write-Host "  Writable: YES" -ForegroundColor Green
        } catch {
            Write-Host ("  Writable: NO - " + $_.Exception.Message) -ForegroundColor Red
        }
    } else {
        Write-Host "  FOLDER NOT FOUND!" -ForegroundColor Red
    }
}

# Also check if zuakha033 file or key exists anywhere
Write-Host ""
Write-Host "=== Search for zuakha033 ==="
Get-ChildItem "C:\Program Files (x86)\Electricity Customers Accounts System" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*zuak*" -or $_.Name -like "*license*" -or $_.Name -like "*.lic*" } |
    ForEach-Object { Write-Host ("  " + $_.FullName) }

# Check ECAS log files or temp HTML files
Write-Host ""
Write-Host "=== ECAS temp HTML files ==="
Get-ChildItem "C:\Program Files (x86)\Electricity Customers Accounts System" -Filter "temp*.html" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    ForEach-Object { Write-Host ("  " + $_.Name + " | " + [math]::Round($_.Length/1KB,0) + "KB | " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")) }

# Check registry for ECAS or license keys
Write-Host ""
Write-Host "=== Registry check ==="
$regPaths = @("HKLM:\SOFTWARE\YemenID","HKLM:\SOFTWARE\WOW6432Node\YemenID","HKCU:\SOFTWARE\YemenID","HKLM:\SOFTWARE\ECAS")
foreach ($rp in $regPaths) {
    if (Test-Path $rp) {
        Write-Host ("  Found: " + $rp)
        Get-ItemProperty $rp -ErrorAction SilentlyContinue | Format-List | Out-String | ForEach-Object { Write-Host "    $_" }
    }
}
