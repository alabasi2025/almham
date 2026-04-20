$sql = @"
SET NOCOUNT ON;

DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [SMS_WA] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\sms_wa.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\sms_wa.ldf''');

PRINT '=== CompInfosMsSetting DIFFERING columns ==='
DECLARE @col NVARCHAR(200), @q NVARCHAR(MAX);
DECLARE cur1 CURSOR FOR SELECT COLUMN_NAME FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfosMsSetting';
OPEN cur1; FETCH NEXT FROM cur1 INTO @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @q = 'IF EXISTS (SELECT 1 FROM Ecas2672.dbo.CompInfosMsSetting a CROSS JOIN SMS_WA.dbo.CompInfosMsSetting b WHERE ISNULL(CAST(a.[' + @col + '] AS NVARCHAR(500)),''x'') <> ISNULL(CAST(b.[' + @col + '] AS NVARCHAR(500)),''x'')) SELECT ''' + @col + ''' AS col_changed, CAST((SELECT [' + @col + '] FROM Ecas2672.dbo.CompInfosMsSetting) AS NVARCHAR(200)) AS cur, CAST((SELECT [' + @col + '] FROM SMS_WA.dbo.CompInfosMsSetting) AS NVARCHAR(200)) AS bak;';
    EXEC sp_executesql @q;
    FETCH NEXT FROM cur1 INTO @col;
END;
CLOSE cur1; DEALLOCATE cur1;

PRINT ''
PRINT '=== CompInfoWhatsAppSetting DIFFERING columns ==='
DECLARE cur2 CURSOR FOR SELECT COLUMN_NAME FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfoWhatsAppSetting';
OPEN cur2; FETCH NEXT FROM cur2 INTO @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @q = 'IF EXISTS (SELECT 1 FROM Ecas2672.dbo.CompInfoWhatsAppSetting a CROSS JOIN SMS_WA.dbo.CompInfoWhatsAppSetting b WHERE ISNULL(CAST(a.[' + @col + '] AS NVARCHAR(500)),''x'') <> ISNULL(CAST(b.[' + @col + '] AS NVARCHAR(500)),''x'')) SELECT ''' + @col + ''' AS col_changed, CAST((SELECT [' + @col + '] FROM Ecas2672.dbo.CompInfoWhatsAppSetting) AS NVARCHAR(200)) AS cur, CAST((SELECT [' + @col + '] FROM SMS_WA.dbo.CompInfoWhatsAppSetting) AS NVARCHAR(200)) AS bak;';
    EXEC sp_executesql @q;
    FETCH NEXT FROM cur2 INTO @col;
END;
CLOSE cur2; DEALLOCATE cur2;

DROP DATABASE SMS_WA;
"@
Set-Content "C:\Temp\ECAS\smsw.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\smsw-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\smsw.sql -o C:\Temp\ECAS\smsw-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "SMSW" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "SMSW"
Start-Sleep 15
if (Test-Path "C:\Temp\ECAS\smsw-r.txt") { Get-Content "C:\Temp\ECAS\smsw-r.txt" }
Unregister-ScheduledTask -TaskName "SMSW" -Confirm:$false -EA SilentlyContinue
