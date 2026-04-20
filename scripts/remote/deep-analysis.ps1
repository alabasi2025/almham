# COMPREHENSIVE: Compare EVERY table between current Ecas2672 and backup
# Check row counts + checksums + find exact differences
$sql = @"
SET NOCOUNT ON;

-- Restore backup
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [DeepCmp] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\deepcmp.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\deepcmp.ldf''');

-- Compare ALL tables
DECLARE @tbl NVARCHAR(200);
DECLARE @s NVARCHAR(MAX);
DECLARE @c1 INT, @c2 INT, @h1 INT, @h2 INT;

PRINT '========================================';
PRINT 'TABLE | CUR_ROWS | BAK_ROWS | CUR_HASH | BAK_HASH | STATUS';
PRINT '========================================';

DECLARE tcur CURSOR FOR 
    SELECT TABLE_NAME FROM Ecas2672.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
OPEN tcur; FETCH NEXT FROM tcur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @c1 = 0; SET @c2 = 0; SET @h1 = 0; SET @h2 = 0;
        
        SET @s = 'SELECT @c = COUNT(*) FROM Ecas2672.dbo.[' + @tbl + ']';
        EXEC sp_executesql @s, N'@c INT OUTPUT', @c1 OUTPUT;
        
        SET @s = 'SELECT @c = COUNT(*) FROM DeepCmp.dbo.[' + @tbl + ']';
        BEGIN TRY EXEC sp_executesql @s, N'@c INT OUTPUT', @c2 OUTPUT; END TRY BEGIN CATCH SET @c2 = -1; END CATCH;
        
        SET @s = 'SELECT @h = ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(*)),0) FROM Ecas2672.dbo.[' + @tbl + ']';
        BEGIN TRY EXEC sp_executesql @s, N'@h INT OUTPUT', @h1 OUTPUT; END TRY BEGIN CATCH SET @h1 = -999; END CATCH;
        
        SET @s = 'SELECT @h = ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(*)),0) FROM DeepCmp.dbo.[' + @tbl + ']';
        BEGIN TRY EXEC sp_executesql @s, N'@h INT OUTPUT', @h2 OUTPUT; END TRY BEGIN CATCH SET @h2 = -999; END CATCH;
        
        DECLARE @status NVARCHAR(20) = 'OK';
        IF @c1 <> @c2 SET @status = 'ROWS_DIFF';
        ELSE IF @h1 <> @h2 SET @status = 'DATA_DIFF';
        
        IF @status <> 'OK'
            PRINT @tbl + ' | ' + CAST(@c1 AS VARCHAR) + ' | ' + CAST(@c2 AS VARCHAR) + ' | ' + CAST(@h1 AS VARCHAR) + ' | ' + CAST(@h2 AS VARCHAR) + ' | ' + @status;
    END TRY
    BEGIN CATCH
        PRINT @tbl + ' | ERROR: ' + ERROR_MESSAGE();
    END CATCH;
    FETCH NEXT FROM tcur INTO @tbl;
END;
CLOSE tcur; DEALLOCATE tcur;

-- Also check stored procedures
PRINT '';
PRINT '=== Modified Stored Procedures ===';
SELECT 'Ecas2672' as src, a.name, a.modify_date 
FROM Ecas2672.sys.procedures a 
JOIN DeepCmp.sys.procedures b ON a.name = b.name
WHERE HASHBYTES('SHA1', (SELECT definition FROM Ecas2672.sys.sql_modules WHERE object_id = a.object_id))
   <> HASHBYTES('SHA1', (SELECT definition FROM DeepCmp.sys.sql_modules WHERE object_id = b.object_id));

DROP DATABASE DeepCmp;
PRINT 'ANALYSIS COMPLETE';
"@
Set-Content 'C:\Temp\ECAS\deep.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\deep-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\deep.sql" -o "C:\Temp\ECAS\deep-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Deep' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Deep'
Start-Sleep 30
if (Test-Path 'C:\Temp\ECAS\deep-r.txt') { Get-Content 'C:\Temp\ECAS\deep-r.txt' }
else { Start-Sleep 30; if (Test-Path 'C:\Temp\ECAS\deep-r.txt') { Get-Content 'C:\Temp\ECAS\deep-r.txt' } }
Unregister-ScheduledTask -TaskName 'Deep' -Confirm:$false -EA SilentlyContinue
