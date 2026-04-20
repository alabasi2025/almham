# Check E:\ drive state
Write-Host "=== E:\ Drive ===" -ForegroundColor Cyan
if (Test-Path "E:\") {
    $drive = Get-PSDrive E -ErrorAction SilentlyContinue
    if ($drive) {
        Write-Host ("  Free: " + [math]::Round($drive.Free/1GB,2) + " GB  Used: " + [math]::Round($drive.Used/1GB,2) + " GB")
    }
    # List .dbf files
    Write-Host "  DBF files on E:\:"
    Get-ChildItem "E:\" -Filter "*.dbf" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 20 | ForEach-Object {
        Write-Host ("    " + $_.Name + " | " + [math]::Round($_.Length/1MB,1) + "MB | " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm"))
    }
    # Test write permission
    try {
        "test" | Out-File "E:\ecas_test.tmp" -Encoding UTF8
        Remove-Item "E:\ecas_test.tmp" -Force
        Write-Host "  Write test: OK" -ForegroundColor Green
    } catch {
        Write-Host ("  Write test FAILED: " + $_.Exception.Message) -ForegroundColor Red
    }
} else {
    Write-Host "  E:\ NOT FOUND!" -ForegroundColor Red
}

# Check esy.exe versions after fix
Write-Host ""
Write-Host "=== esy.exe current state ===" -ForegroundColor Cyan
$refs = @('2668_Mrany_NewSabalieah','2672_Mrany_Gholeeil','2673_Mrany_Dohmyah')
foreach ($ref in $refs) {
    $f = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_" + $ref + "_Ref\ExeRef\esy.exe"
    if (Test-Path $f) {
        $h = (Get-FileHash $f -Algorithm MD5).Hash
        $d = (Get-Item $f).LastWriteTime.ToString("yyyy-MM-dd")
        Write-Host ("  " + $ref.Substring(0,4) + ": date=$d md5=" + $h.Substring(0,12) + "...")
    }
}

# Try running esy.exe from 2672 ref folder to see what output it gives
Write-Host ""
Write-Host "=== esy.exe test run ===" -ForegroundColor Cyan
$esyPath = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\ExeRef\esy.exe"
try {
    $output = & $esyPath 2>&1
    Write-Host ("  Output: " + $output)
} catch {
    Write-Host ("  Error: " + $_.Exception.Message)
}

# Check if ECAS is currently running for 2672/2673
Write-Host ""
Write-Host "=== ECAS processes ===" -ForegroundColor Cyan
Get-Process -Name "Electricity*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  PID=" + $_.Id + " Name=[" + $_.ProcessName + "] Cmd=[" + $_.MainWindowTitle + "]")
}
