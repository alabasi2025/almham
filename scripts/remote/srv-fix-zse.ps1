# Get zse2668 hash and create zse2672/zse2673 with same hash
# Also get zuc2668 pattern - if formula uses only serial (not db-specific), same hash works
# If formula uses db-specific, we need to trigger ECAS to recreate them

$getHash = "SELECT CONVERT(VARCHAR(MAX), CAST(LOGINPROPERTY('zse2668', 'PasswordHash') AS VARBINARY(512)), 1) AS ZSE_HASH"
$getHash | Out-File "C:\get_zse_hash.sql" -Encoding UTF8

$taskCmd = 'sqlcmd -S localhost -E -i "C:\get_zse_hash.sql" -o "C:\get_zse_hash_out.txt" -W -h-1'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasGetZseHash" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasGetZseHash" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasGetZseHash"; Start-Sleep 8
$hash = (Get-Content "C:\get_zse_hash_out.txt" -Encoding UTF8 | Select-Object -First 1).Trim()
Unregister-ScheduledTask -TaskName "EcasGetZseHash" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "zse2668 hash: $hash"

if ($hash -like "0x*") {
    $createSql = @"
-- Create zse2672 and zse2673 with same password as working zse2668
-- (same server = same hard disk serial = same password if no db-specific component)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zse2672')
    CREATE LOGIN [zse2672] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN [zse2672] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
SELECT 'zse2672 created/updated with zse2668 hash';
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'zse2673')
    CREATE LOGIN [zse2673] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN [zse2673] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
SELECT 'zse2673 created/updated with zse2668 hash';
GO

-- Also recreate zuc2672 and zuc2673 with zuc2668 hash as starting point
-- (will fail if db-specific, but worth trying)
DECLARE @zucHash VARBINARY(512)
SET @zucHash = CAST(LOGINPROPERTY('zuc2668', 'PasswordHash') AS VARBINARY(512))
SELECT CONVERT(VARCHAR(MAX), @zucHash, 1) AS ZUC2668_HASH;
GO

-- Grant db access
USE Ecas2672;
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'zse2672')
    CREATE USER [zse2672] FOR LOGIN [zse2672];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'zse2673')
    CREATE USER [zse2673] FOR LOGIN [zse2673];
GO

USE Ecas2673;
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'zse2673')
    CREATE USER [zse2673] FOR LOGIN [zse2673];
GO

SELECT name, modify_date FROM sys.server_principals WHERE name LIKE 'zse%' ORDER BY name;
GO
"@
    $createSql | Out-File "C:\fix_zse.sql" -Encoding UTF8
    $taskCmd2 = 'sqlcmd -S localhost -E -i "C:\fix_zse.sql" -o "C:\fix_zse_out.txt" -W -s "|"'
    $action2 = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd2)
    Unregister-ScheduledTask -TaskName "EcasFixZse" -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName "EcasFixZse" -Action $action2 -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
    Start-ScheduledTask -TaskName "EcasFixZse"; Start-Sleep 10
    Get-Content "C:\fix_zse_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "EcasFixZse" -Confirm:$false -ErrorAction SilentlyContinue
} else {
    Write-Host "Failed to get hash: $hash"
}
