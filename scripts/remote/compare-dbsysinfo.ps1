# Compare DB_And_Sys_Info current vs backup
$sql = @"
SET NOCOUNT ON;
PRINT '=== CURRENT DB_And_Sys_Info ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, DB_Name, DB_PassWord, DB_SysEXEName, DB_Version, adbc, bdbc, noal FROM [?].dbo.DB_And_Sys_Info';

PRINT '=== CURRENT CompInfoAndSysOption (network fields) ==='
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, nDB_UseNetSystem, nDB_ActiveNetSystem, nDB_AutoSyncNet, nDB_ServerName, nDB_DataBaseName, nDB_UserName, nDB_UserPassWord, nDB_PortNo FROM [?].dbo.CompInfoAndSysOption';

PRINT '=== SQL Error Log (last 10) ==='
EXEC sp_readerrorlog 0, 1, NULL, NULL, NULL, NULL, 'DESC';
"@
Set-Content 'C:\Temp\ECAS\cmp.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\cmp-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\cmp.sql" -o "C:\Temp\ECAS\cmp-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CmpDB' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CmpDB'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\cmp-result.txt') { Get-Content 'C:\Temp\ECAS\cmp-result.txt' -First 60 }
Unregister-ScheduledTask -TaskName 'CmpDB' -Confirm:$false -EA SilentlyContinue
