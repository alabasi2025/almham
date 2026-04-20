$sql = @"
SET NOCOUNT ON;

-- Final verification: RankUser.SFID matches UserPrivileg SUM for each rank
PRINT '=== Ecas2672 Final State ==='
SELECT 
    ru.RU_ID, ru.RU_Name, ru.SFID, ru.SEID,
    ISNULL(t.sf, 0) AS actual_SumFrm,
    ISNULL(t.se, 0) AS actual_SumEvn,
    CASE WHEN ru.SFID = ISNULL(t.sf, 0) AND ru.SEID = ISNULL(t.se, 0) THEN 'OK' ELSE 'MISMATCH' END AS status
FROM Ecas2672.dbo.RankUser ru
LEFT JOIN (SELECT RU_ID, SUM(Frm_ID) sf, SUM(Evn_ID) se FROM Ecas2672.dbo.UserPrivileg GROUP BY RU_ID) t ON ru.RU_ID = t.RU_ID
ORDER BY ru.RU_ID;

PRINT ''
PRINT '=== Ecas2673 Final State ==='
SELECT 
    ru.RU_ID, ru.RU_Name, ru.SFID, ru.SEID,
    ISNULL(t.sf, 0) AS actual_SumFrm,
    ISNULL(t.se, 0) AS actual_SumEvn,
    CASE WHEN ru.SFID = ISNULL(t.sf, 0) AND ru.SEID = ISNULL(t.se, 0) THEN 'OK' ELSE 'MISMATCH' END AS status
FROM Ecas2673.dbo.RankUser ru
LEFT JOIN (SELECT RU_ID, SUM(Frm_ID) sf, SUM(Evn_ID) se FROM Ecas2673.dbo.UserPrivileg GROUP BY RU_ID) t ON ru.RU_ID = t.RU_ID
ORDER BY ru.RU_ID;

-- Also check: UserPrivileg rows without matching RankUser
PRINT ''
PRINT '=== Orphan UserPrivileg rows (RU_ID not in RankUser) ==='
SELECT DISTINCT RU_ID FROM Ecas2672.dbo.UserPrivileg up WHERE NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.RankUser WHERE RU_ID = up.RU_ID);
SELECT DISTINCT RU_ID FROM Ecas2673.dbo.UserPrivileg up WHERE NOT EXISTS (SELECT 1 FROM Ecas2673.dbo.RankUser WHERE RU_ID = up.RU_ID);
"@
Set-Content "C:\Temp\ECAS\fv.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\fv-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\fv.sql -o C:\Temp\ECAS\fv-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "FV" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "FV"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\fv-r.txt") { Get-Content "C:\Temp\ECAS\fv-r.txt" }
Unregister-ScheduledTask -TaskName "FV" -Confirm:$false -EA SilentlyContinue
