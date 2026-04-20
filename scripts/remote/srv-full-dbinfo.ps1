$query = @"
-- Get ALL columns from DB_And_Sys_Info for all databases
SELECT 'Ecas2668' AS DB, * FROM Ecas2668.dbo.DB_And_Sys_Info
GO
SELECT 'Ecas2672' AS DB, * FROM Ecas2672.dbo.DB_And_Sys_Info
GO
SELECT 'Ecas2673' AS DB, * FROM Ecas2673.dbo.DB_And_Sys_Info
GO

-- Get column names of DB_And_Sys_Info
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DB_And_Sys_Info'
ORDER BY ORDINAL_POSITION
GO

-- Compare Us_PassWord (admin) and DB_PassWord
SELECT DB='2668',
  (SELECT Us_PassWord FROM Ecas2668.dbo.UserData WHERE RU_ID=2) AS AdminPW,
  (SELECT DB_PassWord FROM Ecas2668.dbo.DB_And_Sys_Info) AS DB_PW,
  (SELECT Brn_DBPassWord FROM Ecas2668.dbo.Branch) AS Brn_PW
UNION ALL
SELECT '2672',
  (SELECT Us_PassWord FROM Ecas2672.dbo.UserData WHERE RU_ID=2),
  (SELECT DB_PassWord FROM Ecas2672.dbo.DB_And_Sys_Info),
  (SELECT Brn_DBPassWord FROM Ecas2672.dbo.Branch)
UNION ALL
SELECT '2673',
  (SELECT Us_PassWord FROM Ecas2673.dbo.UserData WHERE RU_ID=2),
  (SELECT DB_PassWord FROM Ecas2673.dbo.DB_And_Sys_Info),
  (SELECT Brn_DBPassWord FROM Ecas2673.dbo.Branch)
GO
"@

$query | Out-File "C:\full_dbinfo.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\full_dbinfo.sql" -o "C:\full_dbinfo_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasDbInfo" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasDbInfo" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasDbInfo"; Start-Sleep 10
Get-Content "C:\full_dbinfo_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasDbInfo" -Confirm:$false -ErrorAction SilentlyContinue
