$sql = @"
SET NOCOUNT ON;
-- Expected SumFrmID should be computed from FormRankUser JOIN FormEvent
-- If UserPrivileg doesn't match this expected value -> spy detection

PRINT '=== Ecas2672: UserPrivileg vs Expected (from FormRankUser JOIN FormEvent) ==='
SELECT 
    fr.RU_ID,
    SUM(fr.Frm_ID) AS expected_SumFrmID,
    (SELECT SUM(Frm_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = fr.RU_ID) AS actual_SumFrmID,
    CASE 
        WHEN SUM(fr.Frm_ID) = (SELECT SUM(Frm_ID) FROM Ecas2672.dbo.UserPrivileg up WHERE up.RU_ID = fr.RU_ID) 
        THEN 'OK' 
        ELSE 'MISMATCH!' 
    END AS status
FROM Ecas2672.dbo.FormRankUser fr
INNER JOIN Ecas2672.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
GROUP BY fr.RU_ID
ORDER BY fr.RU_ID;

PRINT ''
PRINT '=== Ecas2668 (WORKING): UserPrivileg vs Expected ==='
SELECT 
    fr.RU_ID,
    SUM(fr.Frm_ID) AS expected,
    (SELECT SUM(Frm_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = fr.RU_ID) AS actual,
    CASE 
        WHEN SUM(fr.Frm_ID) = (SELECT SUM(Frm_ID) FROM Ecas2668.dbo.UserPrivileg up WHERE up.RU_ID = fr.RU_ID) 
        THEN 'OK' 
        ELSE 'MISMATCH!' 
    END AS status
FROM Ecas2668.dbo.FormRankUser fr
INNER JOIN Ecas2668.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
GROUP BY fr.RU_ID
ORDER BY fr.RU_ID;
"@
Set-Content 'C:\Temp\ECAS\esum.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\esum-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\esum.sql" -o "C:\Temp\ECAS\esum-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'ESum' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'ESum'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\esum-r.txt') { Get-Content 'C:\Temp\ECAS\esum-r.txt' }
Unregister-ScheduledTask -TaskName 'ESum' -Confirm:$false -EA SilentlyContinue
