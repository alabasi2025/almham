# Disable default trace, delete files, re-enable
$sql = @"
-- Show current trace file
SELECT path FROM sys.traces WHERE is_default = 1;

-- Disable default trace
EXEC sp_configure 'default trace enabled', 0;
RECONFIGURE;
WAITFOR DELAY '00:00:03';
PRINT 'Default trace disabled';
"@
Set-Content 'C:\Temp\ECAS\trace.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\trace-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\trace.sql" -o "C:\Temp\ECAS\trace-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Trace1' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Trace1'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\trace-result.txt') { Get-Content 'C:\Temp\ECAS\trace-result.txt' }
Unregister-ScheduledTask -TaskName 'Trace1' -Confirm:$false -EA SilentlyContinue

# Delete trace files
$traceDir = 'C:\Program Files\Microsoft SQL Server\MSSQL12.MSSQLSERVER\MSSQL\Log'
Get-ChildItem $traceDir -Filter '*.trc' | Remove-Item -Force -EA SilentlyContinue
Write-Output 'Trace files deleted'

# Re-enable default trace
$sql2 = "EXEC sp_configure 'default trace enabled', 1; RECONFIGURE; PRINT 'Trace re-enabled';"
Set-Content 'C:\Temp\ECAS\trace2.sql' $sql2 -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\trace2-result.txt' -Force -EA SilentlyContinue
$action2 = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\trace2.sql" -o "C:\Temp\ECAS\trace2-result.txt" -W'
Register-ScheduledTask -TaskName 'Trace2' -Action $action2 -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Trace2'
Start-Sleep 5
if (Test-Path 'C:\Temp\ECAS\trace2-result.txt') { Get-Content 'C:\Temp\ECAS\trace2-result.txt' }
Unregister-ScheduledTask -TaskName 'Trace2' -Confirm:$false -EA SilentlyContinue
