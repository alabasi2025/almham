$q = @"
-- Copy the EXACT password hash from working zuc2668 to broken zuc2672 and zuc2673
-- This clones the working password to the broken logins

DECLARE @hash VARBINARY(512)

-- Get working password hash from zuc2668
SET @hash = CAST(LOGINPROPERTY('zuc2668', 'PasswordHash') AS VARBINARY(512))
SELECT 'zuc2668 hash retrieved: ' + CONVERT(VARCHAR(20), LEN(@hash)) + ' bytes' AS Info

-- Apply to zuc2672
ALTER LOGIN [zuc2672] WITH PASSWORD = @hash HASHED, CHECK_POLICY = OFF;
SELECT 'zuc2672 password set to match zuc2668' AS Info
GO

DECLARE @hash VARBINARY(512)
SET @hash = CAST(LOGINPROPERTY('zuc2668', 'PasswordHash') AS VARBINARY(512))

-- Apply to zuc2673
ALTER LOGIN [zuc2673] WITH PASSWORD = @hash HASHED, CHECK_POLICY = OFF;
SELECT 'zuc2673 password set to match zuc2668' AS Info
GO

-- Verify modify dates updated
SELECT name, modify_date, is_disabled
FROM sys.server_principals
WHERE name IN ('zuc2668','zuc2672','zuc2673')
ORDER BY name
GO
"@

$q | Out-File "C:\clone_zuc.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\clone_zuc.sql" -o "C:\clone_zuc_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasCloneZuc" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasCloneZuc" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasCloneZuc"; Start-Sleep 8
Get-Content "C:\clone_zuc_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasCloneZuc" -Confirm:$false -ErrorAction SilentlyContinue
