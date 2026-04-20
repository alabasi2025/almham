$setup = @"
-- Create Extended Events session for Ecas2672 login trace
IF EXISTS (SELECT * FROM sys.server_event_sessions WHERE name = 'EcasTrace')
    DROP EVENT SESSION EcasTrace ON SERVER;

CREATE EVENT SESSION EcasTrace ON SERVER
ADD EVENT sqlserver.sql_statement_completed(
    WHERE (
        sqlserver.database_name = N'Ecas2672'
        OR sqlserver.database_name = N'Ecas2673'
    )
    ACTION(sqlserver.sql_text, sqlserver.database_name, sqlserver.username)
)
ADD TARGET package0.ring_buffer(SET MAX_MEMORY = 102400)
WITH (STARTUP_STATE = OFF, EVENT_RETENTION_MODE = ALLOW_SINGLE_EVENT_LOSS);

ALTER EVENT SESSION EcasTrace ON SERVER STATE = START;
SELECT 'EcasTrace session started - NOW try to login to ECAS 2672/2673';
GO
"@

$setup | Out-File "C:\xe_setup.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\xe_setup.sql" -o "C:\xe_setup_out.txt" -W'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasXE" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasXE" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasXE"; Start-Sleep 8
Get-Content "C:\xe_setup_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasXE" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "=== TRACE IS RUNNING ===" -ForegroundColor Green
Write-Host "Now try to login to ECAS 2672/2673. Then run srv-xevent-read.ps1 to see results."
