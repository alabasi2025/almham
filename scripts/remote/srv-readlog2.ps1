$q = @"
-- Get SQL Server error log path
SELECT SERVERPROPERTY('ErrorLogFileName') AS LogPath
GO
-- Read error log using sp_readerrorlog
EXEC sp_readerrorlog 0, 1, 'Login failed'
GO
EXEC sp_readerrorlog 0, 1, 'failed'
GO
"@
$q | Out-File "C:\readlog2.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\readlog2.sql" -o "C:\readlog2_out.txt" -W -s "|" -w 500'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasReadLog2" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasReadLog2" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasReadLog2"; Start-Sleep 10
$out = Get-Content "C:\readlog2_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
# Show only relevant lines
$out | Where-Object { $_ -match 'fail|login|zuc|zse|error|denied' -or $_ -match '^\d{4}' } | Select-Object -Last 50
