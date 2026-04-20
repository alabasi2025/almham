$query = @"
-- Read DB_PassWord as HEX bytes to understand encoding
SELECT 'Ecas2668' AS DB,
  DB_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), DB_PassWord), 1) AS HEX_Value,
  LEN(DB_PassWord) AS Len
FROM Ecas2668.dbo.DB_And_Sys_Info
UNION ALL
SELECT 'Ecas2672',
  DB_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), DB_PassWord), 1),
  LEN(DB_PassWord)
FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL
SELECT 'Ecas2673',
  DB_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), DB_PassWord), 1),
  LEN(DB_PassWord)
FROM Ecas2673.dbo.DB_And_Sys_Info
GO

-- Also read Admin password as HEX
SELECT DB='2668', Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1) AS HEX_PW,
  LEN(Us_PassWord) AS Len
FROM Ecas2668.dbo.UserData WHERE RU_ID=2
UNION ALL
SELECT '2672', Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  LEN(Us_PassWord)
FROM Ecas2672.dbo.UserData WHERE RU_ID=2
UNION ALL
SELECT '2673', Us_PassWord,
  CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Us_PassWord), 1),
  LEN(Us_PassWord)
FROM Ecas2673.dbo.UserData WHERE RU_ID=2
GO

-- Also check Brn_DBPassWord hex
SELECT DB='2668', CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Brn_DBPassWord), 1) AS BrnPW_HEX
FROM Ecas2668.dbo.Branch
UNION ALL
SELECT '2672', CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Brn_DBPassWord), 1) FROM Ecas2672.dbo.Branch
UNION ALL
SELECT '2673', CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), Brn_DBPassWord), 1) FROM Ecas2673.dbo.Branch
GO
"@

$query | Out-File "C:\pw_bytes.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\pw_bytes.sql" -o "C:\pw_bytes_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasPWBytes" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasPWBytes" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasPWBytes"; Start-Sleep 10
Get-Content "C:\pw_bytes_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasPWBytes" -Confirm:$false -ErrorAction SilentlyContinue
