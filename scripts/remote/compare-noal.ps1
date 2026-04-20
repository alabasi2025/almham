# Compare current noal with backup noal
$sql = @"
SET NOCOUNT ON;

-- Current values
PRINT '=== CURRENT noal ==='
SELECT 'Ecas2672' as db, noal FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL SELECT 'Ecas2673', noal FROM Ecas2673.dbo.DB_And_Sys_Info
UNION ALL SELECT 'Ecas2668', noal FROM Ecas2668.dbo.DB_And_Sys_Info;

-- Restore temp DBs to check backup noal
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));

-- Check Ecas2672 backup
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d72 NVARCHAR(200), @l72 NVARCHAR(200);
SELECT @d72 = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l72 = LogicalName FROM @fl WHERE Type = 'L';
DELETE @fl;
EXEC('RESTORE DATABASE [TmpChk72] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d72 + ''' TO N''C:\Temp\ECAS\tmpchk72.mdf'', MOVE N''' + @l72 + ''' TO N''C:\Temp\ECAS\tmpchk72.ldf''');

-- Check Ecas2673 backup
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2673.bak''');
DECLARE @d73 NVARCHAR(200), @l73 NVARCHAR(200);
SELECT @d73 = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l73 = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [TmpChk73] FROM DISK = N''C:\Temp\ECAS\Ecas2673.bak'' WITH REPLACE, MOVE N''' + @d73 + ''' TO N''C:\Temp\ECAS\tmpchk73.mdf'', MOVE N''' + @l73 + ''' TO N''C:\Temp\ECAS\tmpchk73.ldf''');

PRINT '=== BACKUP noal ==='
SELECT 'Ecas2672_BAK' as db, noal FROM TmpChk72.dbo.DB_And_Sys_Info
UNION ALL SELECT 'Ecas2673_BAK', noal FROM TmpChk73.dbo.DB_And_Sys_Info;

DROP DATABASE TmpChk72;
DROP DATABASE TmpChk73;
"@
Set-Content 'C:\Temp\ECAS\noal.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\noal-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\noal.sql" -o "C:\Temp\ECAS\noal-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Noal' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Noal'
Start-Sleep 20
if (Test-Path 'C:\Temp\ECAS\noal-result.txt') { Get-Content 'C:\Temp\ECAS\noal-result.txt' }
Unregister-ScheduledTask -TaskName 'Noal' -Confirm:$false -EA SilentlyContinue
