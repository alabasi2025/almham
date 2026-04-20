$out = @()

# Get hard disk serial via WMI
$out += "=== Hard Disk Serials (WMI) ==="
Get-WmiObject Win32_DiskDrive | ForEach-Object {
    $out += ("  Drive: " + $_.DeviceID + " | Serial: [" + $_.SerialNumber.Trim() + "] | Model: " + $_.Model)
}

# Get volume serial numbers (C: D: E:)
$out += ""
$out += "=== Volume Serials ==="
Get-WmiObject Win32_LogicalDisk | ForEach-Object {
    $out += ("  " + $_.DeviceID + " VolumeSerial=[" + $_.VolumeSerialNumber + "] Label=[" + $_.VolumeName + "]")
}

# Run hds.exe via scheduled task and check for any temp files/registry after
$out += ""
$out += "=== Running hds.exe as SYSTEM ==="
$out -join "`n" | Out-File "C:\hds_serial_out.txt" -Encoding UTF8

# Check registry for any HDS output
$regPaths = @("HKLM:\SOFTWARE\YemenSoft", "HKLM:\SOFTWARE\WOW6432Node\YemenSoft", "HKCU:\SOFTWARE\YemenSoft")
$regOut = @()
foreach ($rp in $regPaths) {
    if (Test-Path $rp) {
        $regOut += ("Found: " + $rp)
        Get-ItemProperty $rp -ErrorAction SilentlyContinue | Format-List | Out-String | ForEach-Object { $regOut += $_ }
    }
}
$regOut -join "`n" | Add-Content "C:\hds_serial_out.txt" -Encoding UTF8

# Run hds.exe and wait
$hds = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\ExeRef\hds.exe"
$proc = Start-Process $hds -PassThru -WindowStyle Hidden -ErrorAction SilentlyContinue
if ($proc) { Start-Sleep 3; $proc | Stop-Process -Force -ErrorAction SilentlyContinue }

# Check temp/appdata for any output
Get-ChildItem $env:TEMP -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-2) } | ForEach-Object {
    "  New temp file: " + $_.Name | Add-Content "C:\hds_serial_out.txt"
}

Write-Host "Done"
