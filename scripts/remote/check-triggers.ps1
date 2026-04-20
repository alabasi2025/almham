$sql = @"
SET NOCOUNT ON;
PRINT '=== Triggers on UserData ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' BEGIN PRINT ''?''; SELECT name, type_desc, is_disabled FROM [?].sys.triggers WHERE parent_id = OBJECT_ID(''[?].dbo.UserData''); END';
PRINT '=== All DDL Triggers ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' BEGIN PRINT ''?''; SELECT name, type_desc FROM [?].sys.triggers WHERE parent_class = 0; END';
PRINT '=== Server-level Triggers ==='
SELECT name, type_desc, is_disabled FROM sys.server_triggers;
"@
Set-Content 'C:\Temp\ECAS\trg.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\trg-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\trg.sql" -o "C:\Temp\ECAS\trg-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Trg' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Trg'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\trg-result.txt') { Get-Content 'C:\Temp\ECAS\trg-result.txt' }
Unregister-ScheduledTask -TaskName 'Trg' -Confirm:$false -EA SilentlyContinue
