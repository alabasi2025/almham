$sql = @"
SET NOCOUNT ON;

-- Manually run what UpdateRankUserSumFormAndEvent does for Ecas2672 and Ecas2673
-- Sync RankUser.SFID/SEID with actual UserPrivileg SUMs

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2672'),('Ecas2673');

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @sql NVARCHAR(MAX) = '
    UPDATE ru
    SET ru.SFID = ISNULL(t.SumFrm, 0), ru.SEID = ISNULL(t.SumEvn, 0)
    FROM [' + @db + '].dbo.RankUser ru
    LEFT JOIN (SELECT RU_ID, SUM(Frm_ID) AS SumFrm, SUM(Evn_ID) AS SumEvn FROM [' + @db + '].dbo.UserPrivileg GROUP BY RU_ID) t ON ru.RU_ID = t.RU_ID;
    SELECT ''' + @db + ''' AS db, RU_ID, RU_Name, SFID, SEID FROM [' + @db + '].dbo.RankUser WHERE RU_ID BETWEEN 1 AND 10';

    EXEC sp_executesql @sql;
    PRINT @db + ' SFID/SEID synced';

    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
"@
Set-Content "C:\Temp\ECAS\sync.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\sync-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\sync.sql -o C:\Temp\ECAS\sync-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "SYNC" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "SYNC"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\sync-r.txt") { Get-Content "C:\Temp\ECAS\sync-r.txt" }
Unregister-ScheduledTask -TaskName "SYNC" -Confirm:$false -EA SilentlyContinue
