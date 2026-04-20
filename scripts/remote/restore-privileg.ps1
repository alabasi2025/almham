$sql = @"
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- Restore UserPrivileg from backup for Ecas2672 and Ecas2673

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2672'),('Ecas2673');

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @bak NVARCHAR(500) = 'C:\Temp\ECAS\' + @db + '.bak';
    DECLARE @tmp NVARCHAR(100) = @db + '_RSTR';
    DECLARE @s NVARCHAR(MAX);
    DECLARE @d NVARCHAR(200), @l NVARCHAR(200);

    DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
    INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''' + @bak + '''');
    SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
    DELETE @fl;

    SET @s = 'RESTORE DATABASE [' + @tmp + '] FROM DISK = N''' + @bak + ''' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\' + @tmp + '.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\' + @tmp + '.ldf''';
    EXEC sp_executesql @s;

    -- Replace UserPrivileg with backup
    SET @s = 'DELETE FROM [' + @db + '].dbo.UserPrivileg; INSERT INTO [' + @db + '].dbo.UserPrivileg SELECT * FROM [' + @tmp + '].dbo.UserPrivileg';
    EXEC sp_executesql @s;

    -- Also restore RankUser SFID/SEID from backup
    SET @s = 'UPDATE a SET a.SFID = b.SFID, a.SEID = b.SEID FROM [' + @db + '].dbo.RankUser a JOIN [' + @tmp + '].dbo.RankUser b ON a.RU_ID = b.RU_ID';
    EXEC sp_executesql @s;

    SET @s = 'DROP DATABASE [' + @tmp + ']';
    EXEC sp_executesql @s;

    PRINT @db + ' UserPrivileg and RankUser restored from backup';

    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;

PRINT ''
PRINT '=== Verification ==='
SELECT 'Ecas2672' AS db, COUNT(*) AS rows FROM Ecas2672.dbo.UserPrivileg
UNION ALL SELECT 'Ecas2673', COUNT(*) FROM Ecas2673.dbo.UserPrivileg;
"@
Set-Content "C:\Temp\ECAS\rst.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\rst-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\rst.sql -o C:\Temp\ECAS\rst-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "RST" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "RST"
Start-Sleep 30
if (Test-Path "C:\Temp\ECAS\rst-r.txt") { Get-Content "C:\Temp\ECAS\rst-r.txt" }
Unregister-ScheduledTask -TaskName "RST" -Confirm:$false -EA SilentlyContinue
