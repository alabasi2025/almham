# Check RankWork, RankUser, and key tables
$sql = @"
PRINT 'RankWork:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as cnt FROM [?].dbo.RankWork';
PRINT 'RankUser:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as cnt FROM [?].dbo.RankUser';
PRINT 'UserWorkBoundary:';
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, COUNT(*) as cnt FROM [?].dbo.UserWorkBoundary';
"@
Set-Content 'C:\Temp\ECAS\v2.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\v2-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\v2.sql" -o "C:\Temp\ECAS\v2-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'V2' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'V2'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\v2-result.txt') { Get-Content 'C:\Temp\ECAS\v2-result.txt' }
Unregister-ScheduledTask -TaskName 'V2' -Confirm:$false -EA SilentlyContinue
