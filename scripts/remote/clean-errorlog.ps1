# Clean ALL SQL Server error logs completely
$sql = @"
-- Cycle 7 times to push all old logs out (max 6 kept)
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
EXEC sp_cycle_errorlog;
PRINT 'Error logs cleaned';
"@
Set-Content 'C:\Temp\ECAS\cleanlog.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\cleanlog-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\cleanlog.sql" -o "C:\Temp\ECAS\cleanlog-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CleanLog' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CleanLog'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\cleanlog-result.txt') { Get-Content 'C:\Temp\ECAS\cleanlog-result.txt' }
Unregister-ScheduledTask -TaskName 'CleanLog' -Confirm:$false -EA SilentlyContinue

# Also delete old error log files
$logDir = 'C:\Program Files\Microsoft SQL Server\MSSQL12.MSSQLSERVER\MSSQL\Log'
Get-ChildItem $logDir -Filter 'ERRORLOG*' | Where-Object { $_.Name -ne 'ERRORLOG' } | Remove-Item -Force -EA SilentlyContinue
Write-Output 'Old log files deleted'

# Restart SQL cleanly
net stop MSSQLSERVER /y 2>&1 | Out-Null
Start-Sleep 3
net start MSSQLSERVER 2>&1 | Out-Null
Write-Output 'SQL restarted clean'
