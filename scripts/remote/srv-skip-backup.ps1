$query = @"
-- Update last backup time to NOW for 2672 and 2673
-- This prevents ECAS from trying to create backup on next login
-- (Backup interval is 2 hours, so setting to NOW buys 2 hours to test login)

UPDATE Ecas2672.dbo.CompInfoAndSysOption SET db_DbBULD = GETDATE();
SELECT 'Ecas2672 backup time updated to: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

UPDATE Ecas2673.dbo.CompInfoAndSysOption SET db_DbBULD = GETDATE();
SELECT 'Ecas2673 backup time updated to: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- Verify
SELECT '2668' AS DB, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2668.dbo.CompInfoAndSysOption
UNION ALL SELECT '2672', db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2672.dbo.CompInfoAndSysOption
UNION ALL SELECT '2673', db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2673.dbo.CompInfoAndSysOption
GO
"@

$query | Out-File "C:\skip_bu.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\skip_bu.sql" -o "C:\skip_bu_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasSkipBU" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasSkipBU" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasSkipBU"; Start-Sleep 8
Get-Content "C:\skip_bu_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasSkipBU" -Confirm:$false -ErrorAction SilentlyContinue
