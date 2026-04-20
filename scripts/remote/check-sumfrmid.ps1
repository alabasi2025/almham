$sql = @"
SET NOCOUNT ON;

-- Restore backup to compare SumFrmID
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [SumChk] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\sumchk.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\sumchk.ldf''');

-- Compute SumFrmID for each user rank
PRINT '=== SumFrmID per RU_ID (Current vs Backup) ==='
SELECT 'UserPrivileg' AS src, 
    (SELECT SUM(CAST(Frm_ID AS BIGINT)) FROM Ecas2672.dbo.UserPrivileg) AS cur_sum,
    (SELECT SUM(CAST(Frm_ID AS BIGINT)) FROM SumChk.dbo.UserPrivileg) AS bak_sum,
    (SELECT SUM(CAST(Frm_ID AS BIGINT) + CAST(Evn_ID AS BIGINT) * 10000 + CAST(RU_ID AS BIGINT) * 1000000) FROM Ecas2672.dbo.UserPrivileg) AS cur_full,
    (SELECT SUM(CAST(Frm_ID AS BIGINT) + CAST(Evn_ID AS BIGINT) * 10000 + CAST(RU_ID AS BIGINT) * 1000000) FROM SumChk.dbo.UserPrivileg) AS bak_full
UNION ALL SELECT 'FormRankUser',
    (SELECT SUM(CAST(Frm_ID AS BIGINT)) FROM Ecas2672.dbo.FormRankUser),
    (SELECT SUM(CAST(Frm_ID AS BIGINT)) FROM SumChk.dbo.FormRankUser),
    (SELECT SUM(CAST(Frm_ID AS BIGINT) + CAST(RU_ID AS BIGINT) * 1000000) FROM Ecas2672.dbo.FormRankUser),
    (SELECT SUM(CAST(Frm_ID AS BIGINT) + CAST(RU_ID AS BIGINT) * 1000000) FROM SumChk.dbo.FormRankUser);

PRINT '=== Row-by-row comparison UserPrivileg ==='
SELECT COUNT(*) AS missing_in_current 
FROM SumChk.dbo.UserPrivileg b 
WHERE NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.UserPrivileg a WHERE a.RU_ID=b.RU_ID AND a.Frm_ID=b.Frm_ID AND a.Evn_ID=b.Evn_ID);

SELECT COUNT(*) AS extra_in_current
FROM Ecas2672.dbo.UserPrivileg a 
WHERE NOT EXISTS (SELECT 1 FROM SumChk.dbo.UserPrivileg b WHERE a.RU_ID=b.RU_ID AND a.Frm_ID=b.Frm_ID AND a.Evn_ID=b.Evn_ID);

DROP DATABASE SumChk;
"@
Set-Content 'C:\Temp\ECAS\sum.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\sum-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\sum.sql" -o "C:\Temp\ECAS\sum-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Sum1' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Sum1'
Start-Sleep 15
if (Test-Path 'C:\Temp\ECAS\sum-r.txt') { Get-Content 'C:\Temp\ECAS\sum-r.txt' }
Unregister-ScheduledTask -TaskName 'Sum1' -Confirm:$false -EA SilentlyContinue
