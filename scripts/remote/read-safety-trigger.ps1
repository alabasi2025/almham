$sql = @"
SET NOCOUNT ON;
PRINT '=== safety trigger code (Ecas2672) ==='
SELECT definition FROM Ecas2672.sys.sql_modules WHERE object_id = (SELECT object_id FROM Ecas2672.sys.triggers WHERE name = 'safety' AND parent_class = 0);
"@
Set-Content 'C:\Temp\ECAS\strig.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\strig-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\strig.sql" -o "C:\Temp\ECAS\strig-result.txt" -y 5000'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'STrg' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'STrg'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\strig-result.txt') { Get-Content 'C:\Temp\ECAS\strig-result.txt' }
Unregister-ScheduledTask -TaskName 'STrg' -Confirm:$false -EA SilentlyContinue
