$q = @"
-- Read SQL Server error log - look for failed logins
EXEC xp_readerrorlog 0, 1, 'Login failed', NULL, NULL, NULL, 'DESC';
GO
"@
$q | Out-File "C:\errlog.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\errlog.sql" -o "C:\errlog_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasErrLog" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasErrLog" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasErrLog"; Start-Sleep 8
Get-Content "C:\errlog_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasErrLog" -Confirm:$false -ErrorAction SilentlyContinue
