$sql = @"
SET NOCOUNT ON;

-- The ECAS app builds UserPrivileg from: FormRankUser × FormEvent
-- Rebuilt rows should equal current UserPrivileg rows
-- If DIFFERENT => spy detection

PRINT '=== Ecas2672: Expected UserPrivileg rows (from FormRankUser JOIN FormEvent) ==='
SELECT COUNT(*) AS expected_rows
FROM Ecas2672.dbo.FormRankUser fr
INNER JOIN Ecas2672.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID;

PRINT 'Actual UserPrivileg rows:'
SELECT COUNT(*) AS actual_rows FROM Ecas2672.dbo.UserPrivileg;

PRINT ''
PRINT '=== Ecas2668 (WORKING): Same check ==='
SELECT COUNT(*) AS expected_rows
FROM Ecas2668.dbo.FormRankUser fr
INNER JOIN Ecas2668.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID;

SELECT COUNT(*) AS actual_rows FROM Ecas2668.dbo.UserPrivileg;

PRINT ''
PRINT '=== Rows in UserPrivileg MISSING from FormRankUser*FormEvent (extra) ==='
SELECT TOP 10 up.RU_ID, up.Frm_ID, up.Evn_ID FROM Ecas2672.dbo.UserPrivileg up
WHERE NOT EXISTS (
    SELECT 1 FROM Ecas2672.dbo.FormRankUser fr 
    INNER JOIN Ecas2672.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
    WHERE fr.RU_ID = up.RU_ID AND fr.Frm_ID = up.Frm_ID AND fe.Evn_ID = up.Evn_ID
);

PRINT ''
PRINT '=== Rows in FormRankUser*FormEvent MISSING from UserPrivileg (needs to be added) ==='
SELECT TOP 10 fr.RU_ID, fr.Frm_ID, fe.Evn_ID FROM Ecas2672.dbo.FormRankUser fr
INNER JOIN Ecas2672.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
WHERE NOT EXISTS (
    SELECT 1 FROM Ecas2672.dbo.UserPrivileg up 
    WHERE up.RU_ID = fr.RU_ID AND up.Frm_ID = fr.Frm_ID AND up.Evn_ID = fe.Evn_ID
);
"@
Set-Content "C:\Temp\ECAS\pv.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\pv-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\pv.sql -o C:\Temp\ECAS\pv-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "PV" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "PV"
Start-Sleep 10
if (Test-Path "C:\Temp\ECAS\pv-r.txt") { Get-Content "C:\Temp\ECAS\pv-r.txt" }
Unregister-ScheduledTask -TaskName "PV" -Confirm:$false -EA SilentlyContinue
