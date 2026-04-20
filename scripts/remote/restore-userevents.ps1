# Restore UserEvent + PaymentWEB from backup for Ecas2672 and Ecas2673
$sql = @"
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2672'),('Ecas2673');
DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @bak NVARCHAR(500) = 'C:\Temp\ECAS\' + @db + '.bak';
    DECLARE @tmp NVARCHAR(100) = @db + '_FIX';
    DECLARE @s NVARCHAR(MAX);
    DECLARE @d NVARCHAR(200), @l NVARCHAR(200);

    DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
    INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''' + @bak + '''');
    SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
    DELETE @fl;

    SET @s = 'RESTORE DATABASE [' + @tmp + '] FROM DISK = N''' + @bak + ''' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\' + @tmp + '.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\' + @tmp + '.ldf''';
    EXEC sp_executesql @s;

    -- Restore UserEvent
    SET @s = 'INSERT INTO [' + @db + '].dbo.UserEvent SELECT * FROM [' + @tmp + '].dbo.UserEvent';
    EXEC sp_executesql @s;
    PRINT @db + ' UserEvent restored';

    -- Restore PaymentWEB
    SET @s = 'INSERT INTO [' + @db + '].dbo.PaymentWEB SELECT * FROM [' + @tmp + '].dbo.PaymentWEB WHERE NOT EXISTS (SELECT 1 FROM [' + @db + '].dbo.PaymentWEB p WHERE p.Pay_No = [' + @tmp + '].dbo.PaymentWEB.Pay_No)';
    BEGIN TRY EXEC sp_executesql @s; PRINT @db + ' PaymentWEB restored'; END TRY BEGIN CATCH PRINT @db + ' PaymentWEB skip'; END CATCH;

    SET @s = 'DROP DATABASE [' + @tmp + ']';
    EXEC sp_executesql @s;

    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
PRINT 'ALL DONE';
"@
Set-Content 'C:\Temp\ECAS\fix-ue.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\fix-ue-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\fix-ue.sql" -o "C:\Temp\ECAS\fix-ue-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'FixUE' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'FixUE'
Start-Sleep 30
if (Test-Path 'C:\Temp\ECAS\fix-ue-r.txt') { Get-Content 'C:\Temp\ECAS\fix-ue-r.txt' }
else { Start-Sleep 30; Get-Content 'C:\Temp\ECAS\fix-ue-r.txt' -EA SilentlyContinue }
Unregister-ScheduledTask -TaskName 'FixUE' -Confirm:$false -EA SilentlyContinue
