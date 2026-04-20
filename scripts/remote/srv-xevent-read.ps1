$read = @"
-- Read the captured SQL statements from EcasTrace
SELECT
  event_data.value('(event/@name)[1]', 'varchar(50)') AS event_name,
  event_data.value('(event/data[@name="statement"]/value)[1]', 'varchar(max)') AS sql_statement,
  event_data.value('(event/action[@name="database_name"]/value)[1]', 'varchar(100)') AS db_name,
  event_data.value('(event/action[@name="username"]/value)[1]', 'varchar(100)') AS username,
  event_data.value('(event/@timestamp)[1]', 'varchar(30)') AS event_time
FROM (
  SELECT CAST(target_data AS XML) AS target_data
  FROM sys.dm_xe_session_targets t
  JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
  WHERE s.name = 'EcasTrace' AND t.target_name = 'ring_buffer'
) AS data
CROSS APPLY target_data.nodes('//RingBufferTarget/event') AS XEventData(event_data)
ORDER BY event_time
GO

-- Stop and drop the session
ALTER EVENT SESSION EcasTrace ON SERVER STATE = STOP;
DROP EVENT SESSION EcasTrace ON SERVER;
SELECT 'Trace stopped';
GO
"@

$read | Out-File "C:\xe_read.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\xe_read.sql" -o "C:\xe_read_out.txt" -W -s "|" -w 2000'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasXERead" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasXERead" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasXERead"; Start-Sleep 12
Get-Content "C:\xe_read_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasXERead" -Confirm:$false -ErrorAction SilentlyContinue
