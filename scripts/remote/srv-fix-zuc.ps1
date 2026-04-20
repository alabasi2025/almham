$q = @"
-- Fix: reset zuc2672 and zuc2673 passwords to match current Administrator Us_PassWord = "nullandnotempty"
-- This syncs the SQL login with what ECAS will derive from the current admin password

ALTER LOGIN [zuc2672] WITH PASSWORD = 'nullandnotempty';
SELECT 'zuc2672 password reset to nullandnotempty';
GO

ALTER LOGIN [zuc2673] WITH PASSWORD = 'nullandnotempty';
SELECT 'zuc2673 password reset to nullandnotempty';
GO

-- Verify all zuc logins exist and are enabled
SELECT name, is_disabled, modify_date
FROM sys.server_principals
WHERE name IN ('zuc2668','zuc2672','zuc2673')
ORDER BY name
GO

-- Also reset zse logins just in case
ALTER LOGIN [zse2672] WITH PASSWORD = 'nullandnotempty';
ALTER LOGIN [zse2673] WITH PASSWORD = 'nullandnotempty';
SELECT 'zse2672 and zse2673 also reset';
GO
"@

$q | Out-File "C:\fix_zuc.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\fix_zuc.sql" -o "C:\fix_zuc_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasFixZuc" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasFixZuc" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasFixZuc"; Start-Sleep 8
Get-Content "C:\fix_zuc_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasFixZuc" -Confirm:$false -ErrorAction SilentlyContinue
