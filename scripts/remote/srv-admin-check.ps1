$q = @"
-- Current Administrator (RU_ID=1) password on SERVER RIGHT NOW
SELECT DB='2668', RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate
FROM Ecas2668.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT '2672', RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate
FROM Ecas2672.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT '2673', RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate
FROM Ecas2673.dbo.UserData WHERE RU_ID = 1
GO

-- Administrator password as HEX bytes
SELECT DB='2668',
  Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1) AS HEX_PW,
  LEN(Us_PassWord) AS PW_Len
FROM Ecas2668.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT '2672',
  Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  LEN(Us_PassWord)
FROM Ecas2672.dbo.UserData WHERE RU_ID = 1
UNION ALL
SELECT '2673',
  Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  LEN(Us_PassWord)
FROM Ecas2673.dbo.UserData WHERE RU_ID = 1
GO

-- Check zuc and zse login password hashes
SELECT name,
  LOGINPROPERTY(name, 'PasswordHash') AS PW_Hash,
  LOGINPROPERTY(name, 'IsExpired') AS IsExpired,
  LOGINPROPERTY(name, 'IsLocked') AS IsLocked,
  create_date, modify_date
FROM sys.server_principals
WHERE name LIKE 'zuc%' OR name LIKE 'zse%'
ORDER BY name
GO

-- Try connecting with each login using Administrator password
-- Check what password would make zuc2672 match
SELECT 'zuc2668 hash:' AS Info, CONVERT(VARCHAR(MAX), LOGINPROPERTY('zuc2668', 'PasswordHash'), 1) AS Hash
UNION ALL SELECT 'zuc2672 hash:', CONVERT(VARCHAR(MAX), LOGINPROPERTY('zuc2672', 'PasswordHash'), 1)
UNION ALL SELECT 'zuc2673 hash:', CONVERT(VARCHAR(MAX), LOGINPROPERTY('zuc2673', 'PasswordHash'), 1)
UNION ALL SELECT 'zse2668 hash:', CONVERT(VARCHAR(MAX), LOGINPROPERTY('zse2668', 'PasswordHash'), 1)
UNION ALL SELECT 'zse2672 hash:', CONVERT(VARCHAR(MAX), LOGINPROPERTY('zse2672', 'PasswordHash'), 1)
UNION ALL SELECT 'zse2673 hash:', CONVERT(VARCHAR(MAX), LOGINPROPERTY('zse2673', 'PasswordHash'), 1)
GO
"@

$q | Out-File "C:\admin_check.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\admin_check.sql" -o "C:\admin_check_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasAdmin" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasAdmin" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasAdmin"; Start-Sleep 10
Get-Content "C:\admin_check_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasAdmin" -Confirm:$false -ErrorAction SilentlyContinue
