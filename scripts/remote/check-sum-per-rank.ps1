$sql = @"
SET NOCOUNT ON;

DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [RankSum] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\ranksum.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\ranksum.ldf''');

-- Per-RU_ID SumFrmID comparison
PRINT '=== SumFrmID per RU_ID: Current Ecas2672 ==='
SELECT RU_ID, SUM(Frm_ID) AS SumFrmID, SUM(Evn_ID) AS SumFvnID, COUNT(*) AS rowcnt 
FROM Ecas2672.dbo.UserPrivileg GROUP BY RU_ID ORDER BY RU_ID;

PRINT '=== SumFrmID per RU_ID: Backup ==='
SELECT RU_ID, SUM(Frm_ID) AS SumFrmID, SUM(Evn_ID) AS SumFvnID, COUNT(*) AS rowcnt 
FROM RankSum.dbo.UserPrivileg GROUP BY RU_ID ORDER BY RU_ID;

PRINT '=== DIFFERENCES (cur != bak) ==='
SELECT a.RU_ID, 
       a.s AS cur_SumFrm, b.s AS bak_SumFrm,
       a.v AS cur_SumEvn, b.v AS bak_SumEvn
FROM (SELECT RU_ID, SUM(Frm_ID) s, SUM(Evn_ID) v FROM Ecas2672.dbo.UserPrivileg GROUP BY RU_ID) a
FULL OUTER JOIN (SELECT RU_ID, SUM(Frm_ID) s, SUM(Evn_ID) v FROM RankSum.dbo.UserPrivileg GROUP BY RU_ID) b
ON a.RU_ID = b.RU_ID
WHERE ISNULL(a.s,0) <> ISNULL(b.s,0) OR ISNULL(a.v,0) <> ISNULL(b.v,0);

DROP DATABASE RankSum;
"@
Set-Content 'C:\Temp\ECAS\rs.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\rs-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\rs.sql" -o "C:\Temp\ECAS\rs-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'RS1' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'RS1'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\rs-r.txt') { Get-Content 'C:\Temp\ECAS\rs-r.txt' }
Unregister-ScheduledTask -TaskName 'RS1' -Confirm:$false -EA SilentlyContinue
