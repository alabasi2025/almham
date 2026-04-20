# Find EXACT differences in the 4 changed tables
$sql = @"
SET NOCOUNT ON;

-- Restore backup
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [Diff72] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\diff72.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\diff72.ldf''');

-- 1. DB_And_Sys_Info differences
PRINT '=== DB_And_Sys_Info DIFF ==='
SELECT 'CURRENT' as src, DB_Name, CONVERT(VARBINARY(50),DB_PassWord) as pw, DB_Version, noal FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL
SELECT 'BACKUP', DB_Name, CONVERT(VARBINARY(50),DB_PassWord), DB_Version, noal FROM Diff72.dbo.DB_And_Sys_Info;

-- 2. CompInfosMsSetting differences  
PRINT '=== CompInfosMsSetting DIFF ==='
DECLARE @cols1 NVARCHAR(MAX) = '';
SELECT @cols1 = @cols1 + 'CASE WHEN ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(200)),'''') <> ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(200)),'''') THEN ''' + COLUMN_NAME + ''' ELSE NULL END, '
FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfosMsSetting';
SET @cols1 = LEFT(@cols1, LEN(@cols1) - 1);
EXEC('SELECT ' + @cols1 + ' FROM Ecas2672.dbo.CompInfosMsSetting a CROSS JOIN Diff72.dbo.CompInfosMsSetting b');

-- 3. CompInfoWhatsAppSetting differences
PRINT '=== CompInfoWhatsAppSetting DIFF ==='
DECLARE @cols2 NVARCHAR(MAX) = '';
SELECT @cols2 = @cols2 + 'CASE WHEN ISNULL(CAST(a.[' + COLUMN_NAME + '] AS NVARCHAR(200)),'''') <> ISNULL(CAST(b.[' + COLUMN_NAME + '] AS NVARCHAR(200)),'''') THEN ''' + COLUMN_NAME + ''' ELSE NULL END, '
FROM Ecas2672.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompInfoWhatsAppSetting';
SET @cols2 = LEFT(@cols2, LEN(@cols2) - 1);
EXEC('SELECT ' + @cols2 + ' FROM Ecas2672.dbo.CompInfoWhatsAppSetting a CROSS JOIN Diff72.dbo.CompInfoWhatsAppSetting b');

-- 4. Customer - how many rows differ?
PRINT '=== Customer DIFF ==='
SELECT COUNT(*) as changed_customers FROM Ecas2672.dbo.Customer a JOIN Diff72.dbo.Customer b ON a.Cst_ID = b.Cst_ID WHERE BINARY_CHECKSUM(a.*) <> BINARY_CHECKSUM(b.*);
-- Sample one changed customer
SELECT TOP 1 a.Cst_ID, a.Cst_Name, a.Cst_LastRead as cur_read, b.Cst_LastRead as bak_read, a.Cst_LastBalance as cur_bal, b.Cst_LastBalance as bak_bal, a.Cst_UpDateDate as cur_date, b.Cst_UpDateDate as bak_date
FROM Ecas2672.dbo.Customer a JOIN Diff72.dbo.Customer b ON a.Cst_ID = b.Cst_ID WHERE BINARY_CHECKSUM(a.*) <> BINARY_CHECKSUM(b.*);

DROP DATABASE Diff72;
PRINT 'DONE';
"@
Set-Content 'C:\Temp\ECAS\diff.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\diff-r.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\diff.sql" -o "C:\Temp\ECAS\diff-r.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Diff' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Diff'
Start-Sleep 20
if (Test-Path 'C:\Temp\ECAS\diff-r.txt') { Get-Content 'C:\Temp\ECAS\diff-r.txt' }
Unregister-ScheduledTask -TaskName 'Diff' -Confirm:$false -EA SilentlyContinue
