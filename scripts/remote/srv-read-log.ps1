$q = @"
SELECT '=== Ecas2672 Log ===' AS Info;
SELECT LogID, LogTime, TableName, Action, OldValues, NewValues, AppName FROM Ecas2672.dbo.ECAS_DebugLog ORDER BY LogID;
GO
SELECT '=== Ecas2673 Log ===' AS Info;
SELECT LogID, LogTime, TableName, Action, OldValues, NewValues, AppName FROM Ecas2673.dbo.ECAS_DebugLog ORDER BY LogID;
GO
"@

$q | Out-File "C:\read_log.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\read_log.sql" -o "C:\read_log_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasReadLog" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasReadLog" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasReadLog"; Start-Sleep 8
Get-Content "C:\read_log_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasReadLog" -Confirm:$false -ErrorAction SilentlyContinue
