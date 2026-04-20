$sql = @"
SET NOCOUNT ON;

-- Check Administrator Us_UpDateDate in all 5 databases, compare with backup
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2672'),('Ecas2673');

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @bak NVARCHAR(500) = 'C:\Temp\ECAS\' + @db + '.bak';
    DECLARE @tmp NVARCHAR(100) = @db + '_DCHK';
    DECLARE @d NVARCHAR(200), @l NVARCHAR(200);

    DELETE @fl;
    INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''' + @bak + '''');
    SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; 
    SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
    
    DECLARE @s NVARCHAR(MAX) = 'RESTORE DATABASE [' + @tmp + '] FROM DISK = N''' + @bak + ''' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\' + @tmp + '.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\' + @tmp + '.ldf''';
    EXEC sp_executesql @s;

    PRINT '=== ' + @db + ' UserData: current vs backup ==='
    SET @s = 'SELECT ''CUR'' AS src, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM [' + @db + '].dbo.UserData WHERE Us_ID < 30000 UNION ALL SELECT ''BAK'', Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM [' + @tmp + '].dbo.UserData WHERE Us_ID < 30000 ORDER BY Us_ID, src';
    EXEC sp_executesql @s;

    SET @s = 'DROP DATABASE [' + @tmp + ']';
    EXEC sp_executesql @s;

    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
"@
Set-Content "C:\Temp\ECAS\ad.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\ad-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\ad.sql -o C:\Temp\ECAS\ad-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "AD" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "AD"
Start-Sleep 15
if (Test-Path "C:\Temp\ECAS\ad-r.txt") { Get-Content "C:\Temp\ECAS\ad-r.txt" }
Unregister-ScheduledTask -TaskName "AD" -Confirm:$false -EA SilentlyContinue
