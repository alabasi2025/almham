$sql = @"
PRINT '=== ErrorTable ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as rows FROM [?].dbo.ErrorTable';
PRINT '=== HardDiskDrivesInfo ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as rows FROM [?].dbo.HardDiskDrivesInfo';
PRINT '=== UserData ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as rows FROM [?].dbo.UserData';
PRINT '=== Unauthorized SQL Logins ==='
SELECT name, is_disabled FROM sys.server_principals WHERE name IN ('cascade','ABBASIYSERVER\Mohammed');
IF @@ROWCOUNT = 0 PRINT 'None - clean';
PRINT '=== ALL OK ==='
"@
Set-Content 'C:\Temp\ECAS\fc.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\fc-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\fc.sql" -o "C:\Temp\ECAS\fc-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'FC' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'FC'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\fc-result.txt') { Get-Content 'C:\Temp\ECAS\fc-result.txt' }
Unregister-ScheduledTask -TaskName 'FC' -Confirm:$false -EA SilentlyContinue
