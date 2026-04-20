$sql = @"
SET NOCOUNT ON;

-- Restore backup
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [CustChk] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\custchk.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\custchk.ldf''');

-- Sample changed customers - show basic fields
PRINT '=== Sample changed customers ==='
SELECT TOP 5 
    a.Cst_ID, 
    a.Cst_Name,
    a.Cst_LastRead AS cur_LastRead, b.Cst_LastRead AS bak_LastRead,
    a.Cst_LastBalance AS cur_Bal, b.Cst_LastBalance AS bak_Bal,
    a.Cst_UpDateDate AS cur_UpDate, b.Cst_UpDateDate AS bak_UpDate
FROM Ecas2672.dbo.Customer a INNER JOIN CustChk.dbo.Customer b ON a.Cst_ID = b.Cst_ID 
WHERE a.Cst_LastRead <> b.Cst_LastRead 
   OR a.Cst_LastBalance <> b.Cst_LastBalance
   OR a.Cst_UpDateDate <> b.Cst_UpDateDate;

-- A_DatabaseLog new entries - show all columns
PRINT '=== A_DatabaseLog columns ==='
SELECT TOP 1 * FROM Ecas2672.dbo.A_DatabaseLog;

DROP DATABASE CustChk;
"@
Set-Content 'C:\Temp\ECAS\custd.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\custd-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\custd.sql" -o "C:\Temp\ECAS\custd-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CustD' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CustD'
Start-Sleep 15
if (Test-Path 'C:\Temp\ECAS\custd-r.txt') { Get-Content 'C:\Temp\ECAS\custd-r.txt' }
Unregister-ScheduledTask -TaskName 'CustD' -Confirm:$false -EA SilentlyContinue
