# Check what's missing and fix ErrorTable
# Use SYSTEM scheduled task since our logins are deleted

$sql = @"
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- Check ErrorTable counts in all databases
PRINT 'ErrorTable counts:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as rows FROM [?].dbo.ErrorTable';

-- Check HardDiskDrivesInfo counts
PRINT 'HardDiskDrivesInfo counts:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as rows FROM [?].dbo.HardDiskDrivesInfo';

-- Check UserData Admin password
PRINT 'Admin passwords:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, Us_PassWord FROM [?].dbo.UserData WHERE Us_ID = -1';

PRINT 'CHECK DONE';
"@
Set-Content 'C:\Temp\ECAS\check.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\check-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\check.sql" -o "C:\Temp\ECAS\check-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CheckDB' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CheckDB'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\check-result.txt') { Get-Content 'C:\Temp\ECAS\check-result.txt' }
Unregister-ScheduledTask -TaskName 'CheckDB' -Confirm:$false -EA SilentlyContinue
