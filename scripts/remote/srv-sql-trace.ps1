$q = @"
SELECT @@VERSION AS SqlVersion;
GO

-- Use sp_trace (compatible with all SQL Server versions)
DECLARE @rc INT, @TraceID INT, @maxfilesize BIGINT = 50

EXEC @rc = sp_trace_create @TraceID OUTPUT, 0, N'C:\ecas_trace', @maxfilesize
IF (@rc != 0) BEGIN SELECT 'sp_trace_create failed: ' + CAST(@rc AS VARCHAR); RETURN END

-- Event: SQL:StmtCompleted (event 41)
EXEC sp_trace_setevent @TraceID, 41, 1, 1   -- TextData
EXEC sp_trace_setevent @TraceID, 41, 8, 1   -- HostName
EXEC sp_trace_setevent @TraceID, 41, 10, 1  -- ApplicationName
EXEC sp_trace_setevent @TraceID, 41, 35, 1  -- DatabaseName

-- Filter: only Ecas2672 or Ecas2673
EXEC sp_trace_setfilter @TraceID, 35, 0, 6, N'Ecas2672' -- DatabaseName LIKE
EXEC sp_trace_setfilter @TraceID, 35, 0, 7, N'Ecas2673' -- DatabaseName LIKE (OR)

-- Start trace
EXEC sp_trace_setstatus @TraceID, 1
SELECT 'Trace started. TraceID = ' + CAST(@TraceID AS VARCHAR) + '. File: C:\ecas_trace.trc'
GO
"@

$q | Out-File "C:\setup_trace.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\setup_trace.sql" -o "C:\setup_trace_out.txt" -W'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasTrace" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasTrace" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasTrace"; Start-Sleep 8
Get-Content "C:\setup_trace_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasTrace" -Confirm:$false -ErrorAction SilentlyContinue
