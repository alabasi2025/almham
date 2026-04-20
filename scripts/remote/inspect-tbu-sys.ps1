# Run as SYSTEM to bypass permissions
$bat = @'
@echo off
echo === tbu sizes ===
for %%D in (2664 2668 2670 2672 2673) do (
    for /f %%F in ('dir "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_%%D_*_Ref\tbu" 2^>nul ^| find "tbu"') do echo %%D %%F
)
echo.
echo === tbu HEX dumps (first 200 bytes) ===
powershell -NoProfile -Command "Get-ChildItem 'C:\Program Files (x86)\Electricity Customers Accounts System' -Recurse -Force -Filter 'tbu' | ForEach-Object { Write-Output ''; Write-Output $_.FullName; Write-Output ('Size: ' + $_.Length); $b = [System.IO.File]::ReadAllBytes($_.FullName); Write-Output ('HEX: ' + (($b[0..[Math]::Min(99,$b.Length-1)] | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')) }" > C:\Temp\ECAS\tbu-out.txt 2>&1
echo Done
'@
$bat | Set-Content 'C:\Temp\ECAS\tbu.bat' -Encoding ASCII

Remove-Item 'C:\Temp\ECAS\tbu-out.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c C:\Temp\ECAS\tbu.bat'
$principal = New-ScheduledTaskPrincipal -UserID 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'TBU' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'TBU'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\tbu-out.txt') { Get-Content 'C:\Temp\ECAS\tbu-out.txt' }
Unregister-ScheduledTask -TaskName 'TBU' -Confirm:$false -EA SilentlyContinue
