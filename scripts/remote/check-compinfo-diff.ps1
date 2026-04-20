$sql = @"
SET NOCOUNT ON;

DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [CmpCI] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\cmpci.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\cmpci.ldf''');

PRINT '=== Finding DIFFERENT columns in CompInfoAndSysOption (Ecas2672 current vs backup) ==='
DECLARE @sql NVARCHAR(MAX) = 'SELECT ';
SELECT @sql = @sql + 'CASE WHEN ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(500)),''<NULL>'') <> ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(500)),''<NULL>'') THEN ''' + COLUMN_NAME + '='''''' + ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(100)),''NULL'') + '''''' vs '''''' + ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(100)),''NULL'') + '''''''' END AS col_' + COLUMN_NAME + ', '
FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfoAndSysOption';
SET @sql = LEFT(@sql, LEN(@sql) - 1) + ' FROM Ecas2672.dbo.CompInfoAndSysOption a CROSS JOIN CmpCI.dbo.CompInfoAndSysOption b';

-- Execute and capture results as rows
CREATE TABLE #res (col_name NVARCHAR(4000));
-- Instead of complex dynamic, just find the differing cols individually
DECLARE cur CURSOR FOR SELECT COLUMN_NAME FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfoAndSysOption';
DECLARE @col NVARCHAR(200);
OPEN cur; FETCH NEXT FROM cur INTO @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @q NVARCHAR(MAX) = 'IF EXISTS (SELECT 1 FROM Ecas2672.dbo.CompInfoAndSysOption a CROSS JOIN CmpCI.dbo.CompInfoAndSysOption b WHERE ISNULL(CAST(a.[' + @col + '] AS NVARCHAR(500)),''x'') <> ISNULL(CAST(b.[' + @col + '] AS NVARCHAR(500)),''x'')) PRINT ''DIFF: ' + @col + ''';';
    EXEC sp_executesql @q;
    FETCH NEXT FROM cur INTO @col;
END;
CLOSE cur; DEALLOCATE cur;

DROP TABLE #res;
DROP DATABASE CmpCI;
"@
Set-Content "C:\Temp\ECAS\ci.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\ci-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\ci.sql -o C:\Temp\ECAS\ci-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "CI" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "CI"
Start-Sleep 15
if (Test-Path "C:\Temp\ECAS\ci-r.txt") { Get-Content "C:\Temp\ECAS\ci-r.txt" }
Unregister-ScheduledTask -TaskName "CI" -Confirm:$false -EA SilentlyContinue
