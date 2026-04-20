$sql = @"
SET NOCOUNT ON;

-- Restore temp to compare
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [CmpTmp] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\cmptmp.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\cmptmp.ldf''');

-- Compare EVERY column
PRINT '=== Columns that DIFFER between current Ecas2672 and backup ==='
DECLARE @cols NVARCHAR(MAX) = '';
SELECT @cols = @cols + 'CASE WHEN ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(MAX)),'''') <> ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(MAX)),'''') THEN ''' + COLUMN_NAME + ': ['' + ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(100)),''NULL'') + ''] vs ['' + ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(100)),''NULL'') + '']'' ELSE NULL END, '
FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfoAndSysOption';

-- Remove trailing comma
SET @cols = LEFT(@cols, LEN(@cols) - 1);

DECLARE @sql NVARCHAR(MAX) = 'SELECT ' + @cols + ' FROM Ecas2672.dbo.CompInfoAndSysOption a CROSS JOIN CmpTmp.dbo.CompInfoAndSysOption b';
EXEC sp_executesql @sql;

DROP DATABASE CmpTmp;
PRINT 'DONE';
"@
Set-Content 'C:\Temp\ECAS\cmp2.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\cmp2-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\cmp2.sql" -o "C:\Temp\ECAS\cmp2-r.txt" -y 5000'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Cmp2' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Cmp2'
Start-Sleep 15
if (Test-Path 'C:\Temp\ECAS\cmp2-r.txt') { Get-Content 'C:\Temp\ECAS\cmp2-r.txt' }
Unregister-ScheduledTask -TaskName 'Cmp2' -Confirm:$false -EA SilentlyContinue
