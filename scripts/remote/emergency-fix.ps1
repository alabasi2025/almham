# EMERGENCY: Remove unauthorized SQL logins so ECAS works again
net stop MSSQLSERVER /y
Start-Sleep 3
cmd /c "net start MSSQLSERVER /m"
Start-Sleep 5

@"
DROP LOGIN [cascade];
DROP LOGIN [ABBASIYSERVER\Mohammed];
PRINT 'LOGINS REMOVED';
"@ | Set-Content 'C:\Temp\ECAS\cleanup.sql' -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\cleanup.sql" -o "C:\Temp\ECAS\cleanup-result.txt"'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CleanSQL' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CleanSQL'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\cleanup-result.txt') { Get-Content 'C:\Temp\ECAS\cleanup-result.txt' }
Unregister-ScheduledTask -TaskName 'CleanSQL' -Confirm:$false -EA SilentlyContinue

net stop MSSQLSERVER /y
Start-Sleep 2
net start MSSQLSERVER
Write-Output 'SQL Server restarted normally'
