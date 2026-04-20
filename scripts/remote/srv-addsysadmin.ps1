# Run as SYSTEM via scheduled task to add Mohammed as SQL sysadmin
$sqlScript = @"
-- Add Mohammed as sysadmin
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'ABBASIYSERVER\Mohammed')
    CREATE LOGIN [ABBASIYSERVER\Mohammed] FROM WINDOWS;
ALTER SERVER ROLE sysadmin ADD MEMBER [ABBASIYSERVER\Mohammed];
PRINT 'Done: Mohammed added as sysadmin';
"@

$sqlScript | Out-File "C:\fix_sql.sql" -Encoding UTF8

# Create scheduled task that runs sqlcmd as SYSTEM
$taskName = "AlhamFixSQL"
$cmd = 'sqlcmd -S localhost -E -i "C:\fix_sql.sql" -o "C:\fix_sql_out.txt"'

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $cmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Starting task as SYSTEM..."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 8

$out = if (Test-Path "C:\fix_sql_out.txt") { Get-Content "C:\fix_sql_out.txt" -Raw } else { "No output file" }
Write-Host "SQL Output:"
Write-Host $out

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
