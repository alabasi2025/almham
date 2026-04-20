$q = @"
-- ALL columns of UserData for Administrator (RU_ID=1) - compare all fields
SELECT TOP 1 * FROM Ecas2668.dbo.UserData WHERE RU_ID = 1
GO
SELECT TOP 1 * FROM Ecas2672.dbo.UserData WHERE RU_ID = 1
GO
SELECT TOP 1 * FROM Ecas2673.dbo.UserData WHERE RU_ID = 1
GO

-- UserData columns list
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'UserData'
ORDER BY ORDINAL_POSITION
GO

-- Check if there's a field that stores SQL login info
SELECT
  'Ecas2668' AS DB,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1) AS PW_HEX,
  Us_UpDateDate
FROM Ecas2668.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT 'Ecas2672',
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  Us_UpDateDate
FROM Ecas2672.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT 'Ecas2673',
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  Us_UpDateDate
FROM Ecas2673.dbo.UserData WHERE RU_ID = 1
GO

-- Can we connect as zuc2668?
-- Try with password derived from DB_PassWord
EXEC xp_logininfo 'zuc2668';
GO
"@

$q | Out-File "C:\admin_full.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\admin_full.sql" -o "C:\admin_full_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasAdminFull" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasAdminFull" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasAdminFull"; Start-Sleep 10
Get-Content "C:\admin_full_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasAdminFull" -Confirm:$false -ErrorAction SilentlyContinue
