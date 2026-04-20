$sql = @"
SET NOCOUNT ON;

PRINT '=== A_DatabaseLog - Latest 20 entries in Ecas2672 ==='
SELECT TOP 20 * FROM Ecas2672.dbo.A_DatabaseLog ORDER BY A_DL_ID DESC;

PRINT ''
PRINT '=== A_DatabaseLog - Latest 20 entries in Ecas2673 ==='
SELECT TOP 20 * FROM Ecas2673.dbo.A_DatabaseLog ORDER BY A_DL_ID DESC;

PRINT ''
PRINT '=== A_DatabaseLog - Latest 20 entries in Ecas2668 (working) ==='
SELECT TOP 20 * FROM Ecas2668.dbo.A_DatabaseLog ORDER BY A_DL_ID DESC;
"@
Set-Content "C:\Temp\ECAS\dl.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\dl-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\dl.sql -o C:\Temp\ECAS\dl-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "DL" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "DL"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\dl-r.txt") { Get-Content "C:\Temp\ECAS\dl-r.txt" }
Unregister-ScheduledTask -TaskName "DL" -Confirm:$false -EA SilentlyContinue
