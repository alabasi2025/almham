$sql = @"
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'default trace enabled', 0; RECONFIGURE;
WAITFOR DELAY '00:00:03';
EXEC sp_configure 'default trace enabled', 1; RECONFIGURE;
EXEC sp_configure 'show advanced options', 0; RECONFIGURE;
PRINT 'Trace reset - old events gone';
"@
Set-Content 'C:\Temp\ECAS\tr3.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\tr3-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\tr3.sql" -o "C:\Temp\ECAS\tr3-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Tr3' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Tr3'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\tr3-r.txt') { Get-Content 'C:\Temp\ECAS\tr3-r.txt' }
Unregister-ScheduledTask -TaskName 'Tr3' -Confirm:$false -EA SilentlyContinue
