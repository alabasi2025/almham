$fixQuery = @"
-- Fix RankUser SFID/SEID for Ecas2672
UPDATE Ecas2672.dbo.RankUser
SET SFID = ISNULL(p.SumFrm, 0),
    SEID = ISNULL(p.SumEvn, 0)
FROM Ecas2672.dbo.RankUser r
LEFT JOIN (
    SELECT RU_ID,
           SUM(CAST(Frm_ID AS BIGINT)) AS SumFrm,
           SUM(CAST(Evn_ID AS BIGINT)) AS SumEvn
    FROM Ecas2672.dbo.UserPrivileg
    GROUP BY RU_ID
) p ON r.RU_ID = p.RU_ID
WHERE r.RU_ID > 1
  AND (r.SFID <> ISNULL(p.SumFrm,0) OR r.SEID <> ISNULL(p.SumEvn,0));

SELECT 'Ecas2672 RankUser updated: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows';
GO

-- Fix RankUser SFID/SEID for Ecas2673
UPDATE Ecas2673.dbo.RankUser
SET SFID = ISNULL(p.SumFrm, 0),
    SEID = ISNULL(p.SumEvn, 0)
FROM Ecas2673.dbo.RankUser r
LEFT JOIN (
    SELECT RU_ID,
           SUM(CAST(Frm_ID AS BIGINT)) AS SumFrm,
           SUM(CAST(Evn_ID AS BIGINT)) AS SumEvn
    FROM Ecas2673.dbo.UserPrivileg
    GROUP BY RU_ID
) p ON r.RU_ID = p.RU_ID
WHERE r.RU_ID > 1
  AND (r.SFID <> ISNULL(p.SumFrm,0) OR r.SEID <> ISNULL(p.SumEvn,0));

SELECT 'Ecas2673 RankUser updated: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows';
GO

-- Verify: after fix
SELECT '2672' AS DB, r.RU_ID, r.SFID, r.SEID,
  ISNULL(SUM(u.Frm_ID),0) AS CalcSFID, ISNULL(SUM(u.Evn_ID),0) AS CalcSEID,
  CASE WHEN r.SFID = ISNULL(SUM(u.Frm_ID),0) AND r.SEID = ISNULL(SUM(u.Evn_ID),0) THEN 'OK' ELSE 'MISMATCH!' END AS Status
FROM Ecas2672.dbo.RankUser r
LEFT JOIN Ecas2672.dbo.UserPrivileg u ON r.RU_ID = u.RU_ID
WHERE r.RU_ID > 1
GROUP BY r.RU_ID, r.SFID, r.SEID
UNION ALL
SELECT '2673', r.RU_ID, r.SFID, r.SEID,
  ISNULL(SUM(u.Frm_ID),0), ISNULL(SUM(u.Evn_ID),0),
  CASE WHEN r.SFID = ISNULL(SUM(u.Frm_ID),0) AND r.SEID = ISNULL(SUM(u.Evn_ID),0) THEN 'OK' ELSE 'MISMATCH!' END
FROM Ecas2673.dbo.RankUser r
LEFT JOIN Ecas2673.dbo.UserPrivileg u ON r.RU_ID = u.RU_ID
WHERE r.RU_ID > 1
GROUP BY r.RU_ID, r.SFID, r.SEID
ORDER BY 1,2;
GO
"@

$fixQuery | Out-File "C:\fix_sfid.sql" -Encoding UTF8

$taskCmd = 'sqlcmd -S localhost -E -i "C:\fix_sfid.sql" -o "C:\fix_sfid_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Unregister-ScheduledTask -TaskName "EcasFixSFID" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasFixSFID" -Action $action -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "EcasFixSFID"
Start-Sleep -Seconds 15

if (Test-Path "C:\fix_sfid_out.txt") {
    Get-Content "C:\fix_sfid_out.txt" -Encoding UTF8 | Out-String
} else {
    "Output file not found!"
}
Unregister-ScheduledTask -TaskName "EcasFixSFID" -Confirm:$false -ErrorAction SilentlyContinue
