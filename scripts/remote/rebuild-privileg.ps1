$sql = @"
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- Rebuild UserPrivileg for Ecas2672 and Ecas2673 from FormRankUser JOIN FormEvent
-- This is the EXACT INSERT that ECAS itself executes

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2672'),('Ecas2673');

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @sql NVARCHAR(MAX);

    -- Insert missing rows
    SET @sql = '
    INSERT INTO [' + @db + '].dbo.UserPrivileg (RU_ID, Frm_ID, Evn_ID)
    SELECT fr.RU_ID, fr.Frm_ID, fe.Evn_ID
    FROM [' + @db + '].dbo.FormRankUser fr
    INNER JOIN [' + @db + '].dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
    WHERE NOT EXISTS (
        SELECT 1 FROM [' + @db + '].dbo.UserPrivileg up 
        WHERE up.RU_ID = fr.RU_ID AND up.Frm_ID = fr.Frm_ID AND up.Evn_ID = fe.Evn_ID
    );
    SELECT ''' + @db + ''' AS db, @@ROWCOUNT AS rows_added';
    EXEC sp_executesql @sql;

    -- Now re-sync RankUser.SFID/SEID
    SET @sql = '
    UPDATE ru
    SET ru.SFID = ISNULL(t.SumFrm, 0), ru.SEID = ISNULL(t.SumEvn, 0)
    FROM [' + @db + '].dbo.RankUser ru
    LEFT JOIN (SELECT RU_ID, SUM(Frm_ID) AS SumFrm, SUM(Evn_ID) AS SumEvn FROM [' + @db + '].dbo.UserPrivileg GROUP BY RU_ID) t ON ru.RU_ID = t.RU_ID';
    EXEC sp_executesql @sql;

    PRINT @db + ' - UserPrivileg rebuilt and SFID synced';

    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;

-- Verify
PRINT ''
PRINT '=== After rebuild ==='
SELECT 'Ecas2672' AS db, COUNT(*) AS rows FROM Ecas2672.dbo.UserPrivileg
UNION ALL SELECT 'Ecas2673', COUNT(*) FROM Ecas2673.dbo.UserPrivileg;
"@
Set-Content "C:\Temp\ECAS\rb.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\rb-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\rb.sql -o C:\Temp\ECAS\rb-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "RB" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "RB"
Start-Sleep 10
if (Test-Path "C:\Temp\ECAS\rb-r.txt") { Get-Content "C:\Temp\ECAS\rb-r.txt" }
Unregister-ScheduledTask -TaskName "RB" -Confirm:$false -EA SilentlyContinue
