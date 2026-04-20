$q = @"
-- Check SQL Server logins
SELECT name, type_desc, is_disabled, create_date, modify_date
FROM sys.server_principals
WHERE type IN ('S','U') -- SQL and Windows logins
ORDER BY modify_date DESC
GO

-- Check DB users
SELECT DB='Ecas2668', name, type_desc, create_date, modify_date
FROM Ecas2668.sys.database_principals WHERE type IN ('S','U','G')
UNION ALL
SELECT 'Ecas2672', name, type_desc, create_date, modify_date
FROM Ecas2672.sys.database_principals WHERE type IN ('S','U','G')
UNION ALL
SELECT 'Ecas2673', name, type_desc, create_date, modify_date
FROM Ecas2673.sys.database_principals WHERE type IN ('S','U','G')
ORDER BY 1, 4 DESC
GO

-- Check if there's a login matching Brn_DBPassWord (as password hash)
-- Check current sa password hash
SELECT LOGINPROPERTY('sa', 'PasswordHash') AS SA_PW_Hash
GO
"@

$q | Out-File "C:\logins.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\logins.sql" -o "C:\logins_out.txt" -W -s "|" -w 300'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasLogins" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasLogins" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasLogins"; Start-Sleep 10
Get-Content "C:\logins_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasLogins" -Confirm:$false -ErrorAction SilentlyContinue
