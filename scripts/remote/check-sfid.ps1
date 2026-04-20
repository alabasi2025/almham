$sql = @"
SET NOCOUNT ON;

PRINT '=== Ecas2672 (BROKEN): Actual SumFrmID vs Stored RankUser.SFID ==='
SELECT 
    ru.RU_ID,
    ru.RU_Name,
    ru.SFID AS stored_SFID,
    ru.SEID AS stored_SEID,
    ISNULL((SELECT SUM(Frm_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) AS actual_SumFrm,
    ISNULL((SELECT SUM(Evn_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) AS actual_SumEvn,
    CASE WHEN ru.SFID = ISNULL((SELECT SUM(Frm_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) 
         AND ru.SEID = ISNULL((SELECT SUM(Evn_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0)
         THEN 'OK' ELSE 'SPY!' END AS status
FROM Ecas2672.dbo.RankUser ru
ORDER BY ru.RU_ID;

PRINT ''
PRINT '=== Ecas2668 (WORKING): Actual SumFrmID vs Stored RankUser.SFID ==='
SELECT 
    ru.RU_ID,
    ru.RU_Name,
    ru.SFID AS stored_SFID,
    ru.SEID AS stored_SEID,
    ISNULL((SELECT SUM(Frm_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) AS actual_SumFrm,
    ISNULL((SELECT SUM(Evn_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) AS actual_SumEvn,
    CASE WHEN ru.SFID = ISNULL((SELECT SUM(Frm_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0) 
         AND ru.SEID = ISNULL((SELECT SUM(Evn_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = ru.RU_ID), 0)
         THEN 'OK' ELSE 'SPY!' END AS status
FROM Ecas2668.dbo.RankUser ru
ORDER BY ru.RU_ID;
"@
Set-Content "C:\Temp\ECAS\sfid.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\sfid-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\sfid.sql -o C:\Temp\ECAS\sfid-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "SFID" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "SFID"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\sfid-r.txt") { Get-Content "C:\Temp\ECAS\sfid-r.txt" }
Unregister-ScheduledTask -TaskName "SFID" -Confirm:$false -EA SilentlyContinue
