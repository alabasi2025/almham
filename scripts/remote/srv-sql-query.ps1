$query = @"
-- DB_And_Sys_Info for all databases
SELECT '2668' AS DB, noal, adbc, bdbc, DB_PassWord, DB_Name FROM Ecas2668.dbo.DB_And_Sys_Info
UNION ALL SELECT '2672', noal, adbc, bdbc, DB_PassWord, DB_Name FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL SELECT '2673', noal, adbc, bdbc, DB_PassWord, DB_Name FROM Ecas2673.dbo.DB_And_Sys_Info
GO

-- UserData all databases
SELECT '2668' AS DB, RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM Ecas2668.dbo.UserData ORDER BY 1,2
SELECT '2672' AS DB, RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM Ecas2672.dbo.UserData ORDER BY 1,2
SELECT '2673' AS DB, RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM Ecas2673.dbo.UserData ORDER BY 1,2
GO

-- noal vs Dev_Serl count
SELECT '2668' AS DB, noal,
  (SELECT COUNT(*) FROM Ecas2668.dbo.CashierData WHERE ISNULL(Dev_Serl,'') <> '') AS DevCount
FROM Ecas2668.dbo.DB_And_Sys_Info
UNION ALL
SELECT '2672', noal,
  (SELECT COUNT(*) FROM Ecas2672.dbo.CashierData WHERE ISNULL(Dev_Serl,'') <> '')
FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL
SELECT '2673', noal,
  (SELECT COUNT(*) FROM Ecas2673.dbo.CashierData WHERE ISNULL(Dev_Serl,'') <> '')
FROM Ecas2673.dbo.DB_And_Sys_Info
GO

-- RankUser SFID/SEID vs UserPrivileg sums
SELECT '2672' AS DB, r.RU_ID, r.RU_Name, r.SFID, r.SEID,
  SUM(u.Frm_ID) AS CalcSFID, SUM(u.Evn_ID) AS CalcSEID,
  CASE WHEN r.SFID=SUM(u.Frm_ID) AND r.SEID=SUM(u.Evn_ID) THEN 'OK' ELSE 'MISMATCH' END AS Status
FROM Ecas2672.dbo.RankUser r LEFT JOIN Ecas2672.dbo.UserPrivileg u ON r.RU_ID=u.RU_ID
WHERE r.RU_ID > 1 GROUP BY r.RU_ID,r.RU_Name,r.SFID,r.SEID
UNION ALL
SELECT '2673', r.RU_ID, r.RU_Name, r.SFID, r.SEID,
  SUM(u.Frm_ID), SUM(u.Evn_ID),
  CASE WHEN r.SFID=SUM(u.Frm_ID) AND r.SEID=SUM(u.Evn_ID) THEN 'OK' ELSE 'MISMATCH' END
FROM Ecas2673.dbo.RankUser r LEFT JOIN Ecas2673.dbo.UserPrivileg u ON r.RU_ID=u.RU_ID
WHERE r.RU_ID > 1 GROUP BY r.RU_ID,r.RU_Name,r.SFID,r.SEID
GO

-- Backup config
SELECT '2668' AS DB, db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2668.dbo.CompInfoAndSysOption
UNION ALL SELECT '2672', db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2672.dbo.CompInfoAndSysOption
UNION ALL SELECT '2673', db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2673.dbo.CompInfoAndSysOption
GO
"@

$query | Out-File "C:\ecas_check.sql" -Encoding UTF8

# Run via scheduled task as SYSTEM
$taskCmd = 'sqlcmd -S localhost -E -i "C:\ecas_check.sql" -o "C:\ecas_check_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Unregister-ScheduledTask -TaskName "EcasCheck" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasCheck" -Action $action -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "EcasCheck"
Start-Sleep -Seconds 12

if (Test-Path "C:\ecas_check_out.txt") {
    Get-Content "C:\ecas_check_out.txt" -Encoding UTF8 | Out-String
} else {
    "Output file not found!"
}
Unregister-ScheduledTask -TaskName "EcasCheck" -Confirm:$false -ErrorAction SilentlyContinue
