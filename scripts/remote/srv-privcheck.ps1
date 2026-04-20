$q = @"
-- Check UserPrivileg entries NOT IN FormRankUser (what ECAS would consider "illegal")
-- This is what triggers "خطاء فى بيانات صلاحيات حقوق الوصول"
SELECT 'Ecas2668' AS DB, COUNT(*) AS IllegalCount
FROM Ecas2668.dbo.UserPrivileg p
WHERE p.RU_ID >= 2
  AND NOT EXISTS (
    SELECT 1 FROM Ecas2668.dbo.FormRankUser f
    WHERE f.RU_ID = p.RU_ID AND f.Frm_ID = p.Frm_ID
  )
UNION ALL
SELECT 'Ecas2672', COUNT(*)
FROM Ecas2672.dbo.UserPrivileg p
WHERE p.RU_ID >= 2
  AND NOT EXISTS (
    SELECT 1 FROM Ecas2672.dbo.FormRankUser f
    WHERE f.RU_ID = p.RU_ID AND f.Frm_ID = p.Frm_ID
  )
UNION ALL
SELECT 'Ecas2673', COUNT(*)
FROM Ecas2673.dbo.UserPrivileg p
WHERE p.RU_ID >= 2
  AND NOT EXISTS (
    SELECT 1 FROM Ecas2673.dbo.FormRankUser f
    WHERE f.RU_ID = p.RU_ID AND f.Frm_ID = p.Frm_ID
  )
GO

-- Show the actual illegal entries for 2672 and 2673
SELECT 'Ecas2672' AS DB, p.RU_ID, p.Frm_ID, p.Evn_ID
FROM Ecas2672.dbo.UserPrivileg p
WHERE p.RU_ID >= 2
  AND NOT EXISTS (
    SELECT 1 FROM Ecas2672.dbo.FormRankUser f
    WHERE f.RU_ID = p.RU_ID AND f.Frm_ID = p.Frm_ID
  )
ORDER BY p.RU_ID, p.Frm_ID
GO

SELECT 'Ecas2673' AS DB, p.RU_ID, p.Frm_ID, p.Evn_ID
FROM Ecas2673.dbo.UserPrivileg p
WHERE p.RU_ID >= 2
  AND NOT EXISTS (
    SELECT 1 FROM Ecas2673.dbo.FormRankUser f
    WHERE f.RU_ID = p.RU_ID AND f.Frm_ID = p.Frm_ID
  )
ORDER BY p.RU_ID, p.Frm_ID
GO

-- Also count UserPrivileg and FormRankUser totals per DB
SELECT DB='2668',
  (SELECT COUNT(*) FROM Ecas2668.dbo.UserPrivileg WHERE RU_ID>=2) AS UP_Count,
  (SELECT COUNT(*) FROM Ecas2668.dbo.FormRankUser WHERE RU_ID>=2) AS FRU_Count
UNION ALL
SELECT '2672',
  (SELECT COUNT(*) FROM Ecas2672.dbo.UserPrivileg WHERE RU_ID>=2),
  (SELECT COUNT(*) FROM Ecas2672.dbo.FormRankUser WHERE RU_ID>=2)
UNION ALL
SELECT '2673',
  (SELECT COUNT(*) FROM Ecas2673.dbo.UserPrivileg WHERE RU_ID>=2),
  (SELECT COUNT(*) FROM Ecas2673.dbo.FormRankUser WHERE RU_ID>=2)
GO
"@

$q | Out-File "C:\privcheck.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\privcheck.sql" -o "C:\privcheck_out.txt" -W -s "|" -w 300'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasPriv" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasPriv" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasPriv"; Start-Sleep 10
Get-Content "C:\privcheck_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasPriv" -Confirm:$false -ErrorAction SilentlyContinue
