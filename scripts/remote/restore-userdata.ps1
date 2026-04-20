# Restore ONLY UserData table from .bak backup (original untouched data)
# This restores the backup to a temp database, copies UserData, then drops temp

$sql = @"
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2664'),('Ecas2668'),('Ecas2670'),('Ecas2672'),('Ecas2673');

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @bak NVARCHAR(500) = 'C:\Temp\ECAS\' + @db + '.bak';
    DECLARE @tempdb NVARCHAR(100) = @db + '_TEMP';
    DECLARE @s NVARCHAR(MAX);

    -- Restore to temp db
    DECLARE @dataFile NVARCHAR(200), @logFile NVARCHAR(200);
    CREATE TABLE #fl (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
    INSERT #fl EXEC('RESTORE FILELISTONLY FROM DISK = N''' + @bak + '''');
    SELECT @dataFile = LogicalName FROM #fl WHERE Type = 'D';
    SELECT @logFile = LogicalName FROM #fl WHERE Type = 'L';
    DROP TABLE #fl;

    SET @s = 'RESTORE DATABASE [' + @tempdb + '] FROM DISK = N''' + @bak + ''' WITH REPLACE, MOVE N''' + @dataFile + ''' TO N''C:\Temp\ECAS\' + @tempdb + '.mdf'', MOVE N''' + @logFile + ''' TO N''C:\Temp\ECAS\' + @tempdb + '_log.ldf''';
    EXEC sp_executesql @s;

    -- Replace UserData
    SET @s = 'DELETE FROM [' + @db + '].dbo.UserData; INSERT INTO [' + @db + '].dbo.UserData SELECT * FROM [' + @tempdb + '].dbo.UserData';
    EXEC sp_executesql @s;

    -- Drop temp
    SET @s = 'DROP DATABASE [' + @tempdb + ']';
    EXEC sp_executesql @s;

    PRINT @db + ' UserData restored from backup';
    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
PRINT 'ALL DONE';
"@
Set-Content 'C:\Temp\ECAS\restore-ud.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\restore-ud-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\restore-ud.sql" -o "C:\Temp\ECAS\restore-ud-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'RestoreUD' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'RestoreUD'
Start-Sleep 30
if (Test-Path 'C:\Temp\ECAS\restore-ud-result.txt') { Get-Content 'C:\Temp\ECAS\restore-ud-result.txt' }
else { Write-Output 'Waiting...'; Start-Sleep 30; if (Test-Path 'C:\Temp\ECAS\restore-ud-result.txt') { Get-Content 'C:\Temp\ECAS\restore-ud-result.txt' } }
Unregister-ScheduledTask -TaskName 'RestoreUD' -Confirm:$false -EA SilentlyContinue
