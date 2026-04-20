# Compare row counts of ALL tables: current Ecas2672 vs Ecas2668 (working)
$sql = @"
SET NOCOUNT ON;
PRINT '=== Tables with DIFFERENT row counts between Ecas2672 (broken) and backup ==='

DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [Bak72] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\bak72.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\bak72.ldf''');

-- Compare every table
DECLARE @tbl NVARCHAR(200);
DECLARE tcur CURSOR FOR SELECT TABLE_NAME FROM Ecas2672.INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
OPEN tcur; FETCH NEXT FROM tcur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @s NVARCHAR(MAX);
    DECLARE @c1 INT, @c2 INT;
    SET @s = 'SELECT @c = COUNT(*) FROM Ecas2672.dbo.[' + @tbl + ']';
    EXEC sp_executesql @s, N'@c INT OUTPUT', @c1 OUTPUT;
    SET @s = 'SELECT @c = COUNT(*) FROM Bak72.dbo.[' + @tbl + ']';
    EXEC sp_executesql @s, N'@c INT OUTPUT', @c2 OUTPUT;
    IF @c1 <> @c2
        PRINT @tbl + ': current=' + CAST(@c1 AS VARCHAR) + ' backup=' + CAST(@c2 AS VARCHAR);
    FETCH NEXT FROM tcur INTO @tbl;
END;
CLOSE tcur; DEALLOCATE tcur;

DROP DATABASE Bak72;
PRINT 'COMPARISON DONE';
"@
Set-Content 'C:\Temp\ECAS\frc.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\frc-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\frc.sql" -o "C:\Temp\ECAS\frc-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'FRC' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'FRC'
Start-Sleep 20
if (Test-Path 'C:\Temp\ECAS\frc-r.txt') { Get-Content 'C:\Temp\ECAS\frc-r.txt' }
Unregister-ScheduledTask -TaskName 'FRC' -Confirm:$false -EA SilentlyContinue
