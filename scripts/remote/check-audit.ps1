$sql = @"
SET NOCOUNT ON;
PRINT '=== Ecas2672 A_DatabaseLog (last 10) ==='
SELECT TOP 10 * FROM Ecas2672.dbo.A_DatabaseLog ORDER BY 1 DESC;
PRINT '=== Ecas2673 A_DatabaseLog (last 10) ==='
SELECT TOP 10 * FROM Ecas2673.dbo.A_DatabaseLog ORDER BY 1 DESC;
PRINT '=== Ecas2668 A_DatabaseLog (last 10 - working) ==='
SELECT TOP 10 * FROM Ecas2668.dbo.A_DatabaseLog ORDER BY 1 DESC;
PRINT '=== Ecas2672 UserEvent (last 10) ==='
SELECT TOP 10 * FROM Ecas2672.dbo.UserEvent ORDER BY 1 DESC;
PRINT '=== Ecas2673 UserEvent (last 10) ==='
SELECT TOP 10 * FROM Ecas2673.dbo.UserEvent ORDER BY 1 DESC;
"@
Set-Content 'C:\Temp\ECAS\audit.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\audit-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\audit.sql" -o "C:\Temp\ECAS\audit-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Audit' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Audit'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\audit-result.txt') { Get-Content 'C:\Temp\ECAS\audit-result.txt' }
Unregister-ScheduledTask -TaskName 'Audit' -Confirm:$false -EA SilentlyContinue
