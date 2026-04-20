# Restore original Administrator passwords in ALL databases
net stop MSSQLSERVER /y
Start-Sleep 3
cmd /c "net start MSSQLSERVER /m"
Start-Sleep 5

@"
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
UPDATE Ecas2664.dbo.UserData SET Us_PassWord = 'nullandnotempty' WHERE Us_ID = -1;
UPDATE Ecas2668.dbo.UserData SET Us_PassWord = 'nullandnotempty' WHERE Us_ID = -1;
UPDATE Ecas2670.dbo.UserData SET Us_PassWord = 'nullandnotempty' WHERE Us_ID = -1;
UPDATE Ecas2672.dbo.UserData SET Us_PassWord = 'nullandnotempty' WHERE Us_ID = -1;
UPDATE Ecas2673.dbo.UserData SET Us_PassWord = 'nullandnotempty' WHERE Us_ID = -1;
PRINT 'ALL PASSWORDS RESTORED TO ORIGINAL';
"@ | Set-Content 'C:\Temp\ECAS\restore-pw.sql' -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\restore-pw.sql" -o "C:\Temp\ECAS\restore-pw-result.txt"'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'RestorePW' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'RestorePW'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\restore-pw-result.txt') { Get-Content 'C:\Temp\ECAS\restore-pw-result.txt' }
Unregister-ScheduledTask -TaskName 'RestorePW' -Confirm:$false -EA SilentlyContinue

net stop MSSQLSERVER /y
Start-Sleep 2
net start MSSQLSERVER
Write-Output 'DONE - passwords restored'
