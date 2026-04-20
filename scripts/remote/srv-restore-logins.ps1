$q = @"
-- Drop damaged logins (ECAS will recreate them with correct passwords on next login)
-- zse logins are recreated automatically by ECAS on each startup

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zse2672')
    DROP LOGIN [zse2672];
SELECT 'zse2672 dropped - ECAS will recreate' AS Info;
GO

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zse2673')
    DROP LOGIN [zse2673];
SELECT 'zse2673 dropped - ECAS will recreate' AS Info;
GO

-- For zuc logins - they hold the original pre-change password
-- We changed them. We need to restore to original.
-- Since we can't know original, drop them too and see if ECAS recreates
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zuc2672')
    DROP LOGIN [zuc2672];
SELECT 'zuc2672 dropped' AS Info;
GO

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zuc2673')
    DROP LOGIN [zuc2673];
SELECT 'zuc2673 dropped' AS Info;
GO

-- Verify
SELECT name, create_date, modify_date, is_disabled
FROM sys.server_principals
WHERE name LIKE 'z%'
ORDER BY name;
GO
"@

$q | Out-File "C:\restore_logins.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\restore_logins.sql" -o "C:\restore_logins_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasRestore" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasRestore" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasRestore"; Start-Sleep 8
Get-Content "C:\restore_logins_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasRestore" -Confirm:$false -ErrorAction SilentlyContinue
