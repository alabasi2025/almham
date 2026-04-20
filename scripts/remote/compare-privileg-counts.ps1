$sql = @"
SET NOCOUNT ON;

PRINT '=== Row count per RU_ID across all 5 databases ==='
SELECT 'Ecas2664' AS db, RU_ID, COUNT(*) AS rows FROM Ecas2664.dbo.UserPrivileg GROUP BY RU_ID
UNION ALL SELECT 'Ecas2668', RU_ID, COUNT(*) FROM Ecas2668.dbo.UserPrivileg GROUP BY RU_ID
UNION ALL SELECT 'Ecas2670', RU_ID, COUNT(*) FROM Ecas2670.dbo.UserPrivileg GROUP BY RU_ID
UNION ALL SELECT 'Ecas2672', RU_ID, COUNT(*) FROM Ecas2672.dbo.UserPrivileg GROUP BY RU_ID
UNION ALL SELECT 'Ecas2673', RU_ID, COUNT(*) FROM Ecas2673.dbo.UserPrivileg GROUP BY RU_ID
ORDER BY RU_ID, db;
"@
Set-Content "C:\Temp\ECAS\cmp2.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\cmp2-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\cmp2.sql -o C:\Temp\ECAS\cmp2-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "CMP2" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "CMP2"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\cmp2-r.txt") { Get-Content "C:\Temp\ECAS\cmp2-r.txt" }
Unregister-ScheduledTask -TaskName "CMP2" -Confirm:$false -EA SilentlyContinue
