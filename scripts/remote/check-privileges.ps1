$sql = @"
SET NOCOUNT ON;

-- Restore backup to compare
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [PrivChk] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\privchk.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\privchk.ldf''');

PRINT '=== Permission tables: current vs backup ==='
SELECT 'UserPrivileg' AS tbl, (SELECT COUNT(*) FROM Ecas2672.dbo.UserPrivileg) AS cur_cnt, (SELECT COUNT(*) FROM PrivChk.dbo.UserPrivileg) AS bak_cnt
UNION ALL SELECT 'FormRankUser', (SELECT COUNT(*) FROM Ecas2672.dbo.FormRankUser), (SELECT COUNT(*) FROM PrivChk.dbo.FormRankUser)
UNION ALL SELECT 'RankUser', (SELECT COUNT(*) FROM Ecas2672.dbo.RankUser), (SELECT COUNT(*) FROM PrivChk.dbo.RankUser)
UNION ALL SELECT 'RankWork', (SELECT COUNT(*) FROM Ecas2672.dbo.RankWork), (SELECT COUNT(*) FROM PrivChk.dbo.RankWork)
UNION ALL SELECT 'UserRestrictedFormTable', (SELECT COUNT(*) FROM Ecas2672.dbo.UserRestrictedFormTable), (SELECT COUNT(*) FROM PrivChk.dbo.UserRestrictedFormTable)
UNION ALL SELECT 'UserRestrictedSomeID', (SELECT COUNT(*) FROM Ecas2672.dbo.UserRestrictedSomeID), (SELECT COUNT(*) FROM PrivChk.dbo.UserRestrictedSomeID)
UNION ALL SELECT 'UserWorkBoundary', (SELECT COUNT(*) FROM Ecas2672.dbo.UserWorkBoundary), (SELECT COUNT(*) FROM PrivChk.dbo.UserWorkBoundary);

DROP DATABASE PrivChk;
"@
Set-Content 'C:\Temp\ECAS\priv.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\priv-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\priv.sql" -o "C:\Temp\ECAS\priv-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Priv' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Priv'
Start-Sleep 15
if (Test-Path 'C:\Temp\ECAS\priv-r.txt') { Get-Content 'C:\Temp\ECAS\priv-r.txt' }
Unregister-ScheduledTask -TaskName 'Priv' -Confirm:$false -EA SilentlyContinue
