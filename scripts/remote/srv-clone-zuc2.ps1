# Get the hash from zuc2668 and build ALTER LOGIN with embedded hex value
$getHashQuery = "SELECT CONVERT(VARCHAR(MAX), CAST(LOGINPROPERTY('zuc2668', 'PasswordHash') AS VARBINARY(512)), 1) AS PW_HASH"
$getHashQuery | Out-File "C:\get_hash.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\get_hash.sql" -o "C:\get_hash_out.txt" -W -h-1'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasGetHash" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasGetHash" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasGetHash"; Start-Sleep 8
Unregister-ScheduledTask -TaskName "EcasGetHash" -Confirm:$false -ErrorAction SilentlyContinue

$hash = (Get-Content "C:\get_hash_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
Write-Host "Hash from zuc2668: $hash"

if ($hash -like "0x*") {
    # Build ALTER LOGIN with embedded hash
    $cloneQuery = @"
ALTER LOGIN [zuc2672] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
SELECT 'zuc2672 cloned from zuc2668 OK';
GO
ALTER LOGIN [zuc2673] WITH PASSWORD = $hash HASHED, CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
SELECT 'zuc2673 cloned from zuc2668 OK';
GO
SELECT name, modify_date FROM sys.server_principals WHERE name LIKE 'zuc%' ORDER BY name;
GO
"@
    $cloneQuery | Out-File "C:\clone_zuc2.sql" -Encoding UTF8
    $taskCmd2 = 'sqlcmd -S localhost -E -i "C:\clone_zuc2.sql" -o "C:\clone_zuc2_out.txt" -W -s "|"'
    $action2 = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd2)
    Unregister-ScheduledTask -TaskName "EcasCloneZuc2" -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName "EcasCloneZuc2" -Action $action2 -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
    Start-ScheduledTask -TaskName "EcasCloneZuc2"; Start-Sleep 8
    Get-Content "C:\clone_zuc2_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "EcasCloneZuc2" -Confirm:$false -ErrorAction SilentlyContinue
} else {
    Write-Host "ERROR: Could not get hash. Got: $hash"
}
