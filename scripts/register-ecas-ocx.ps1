# Register VB6 OCX/DLL files needed by ECAS
# Copy OCX files from server and register them

$ecasDir = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System'

# List all DLL/OCX in the ECAS folder
Write-Host "=== Files in ECAS folder ===" -ForegroundColor Cyan
Get-ChildItem $ecasDir -Include '*.ocx','*.dll' -Recurse | ForEach-Object {
    Write-Host "  $($_.Name) ($([math]::Round($_.Length/1KB)) KB)"
}

# Check common VB6 OCX files
Write-Host ""
Write-Host "=== Checking VB6 OCX on system ===" -ForegroundColor Cyan
$ocxFiles = @('MSCOMCTL.OCX','MSHFLXGD.OCX','MSCOMCT2.OCX','MSSTDFMT.DLL','MSFLXGRD.OCX',
              'COMDLG32.OCX','TABCTL32.OCX','RICHTX32.OCX','MSADODC.OCX','MSDATGRD.OCX',
              'MSWINSCK.OCX','MSINET.OCX','MSCAL.OCX')

foreach ($ocx in $ocxFiles) {
    $path32 = "C:\Windows\SysWOW64\$ocx"
    if (Test-Path $path32) {
        Write-Host "  OK: $ocx" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $ocx" -ForegroundColor Red
    }
}

# Try to get error from Event Viewer
Write-Host ""
Write-Host "=== Recent App Errors ===" -ForegroundColor Cyan
Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2; StartTime=(Get-Date).AddMinutes(-5)} -MaxEvents 5 -EA SilentlyContinue | ForEach-Object {
    Write-Host "  $($_.TimeCreated): $($_.Message.Substring(0, [Math]::Min(200, $_.Message.Length)))"
}
