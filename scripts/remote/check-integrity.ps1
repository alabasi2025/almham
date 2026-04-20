$sql = @"
SET NOCOUNT ON;

PRINT '=== Ecas2672 (BROKEN) Integrity checks ==='

-- Check 1: UserData rows with RU_ID not in RankUser
PRINT '1. UserData rows with invalid RU_ID:'
SELECT ud.Us_ID, ud.Us_Name, ud.RU_ID FROM Ecas2672.dbo.UserData ud 
WHERE NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.RankUser WHERE RU_ID = ud.RU_ID);

-- Check 2: UserData rows with RW_ID not in RankWork
PRINT '2. UserData rows with invalid RW_ID:'
SELECT ud.Us_ID, ud.Us_Name, ud.RW_ID FROM Ecas2672.dbo.UserData ud 
WHERE NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.RankWork WHERE RW_ID = ud.RW_ID);

-- Check 3: UserPrivileg rows with RU_ID not in RankUser
PRINT '3. UserPrivileg rows with invalid RU_ID:'
SELECT DISTINCT RU_ID FROM Ecas2672.dbo.UserPrivileg 
WHERE NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.RankUser ru WHERE ru.RU_ID = UserPrivileg.RU_ID);

-- Check 4: RankUser rows missing from UserPrivileg (orphan ranks)
PRINT '4. RankUser rows with NO permissions (not in UserPrivileg):'
SELECT ru.RU_ID, ru.RU_Name FROM Ecas2672.dbo.RankUser ru 
WHERE ru.RU_ID > 0 AND NOT EXISTS (SELECT 1 FROM Ecas2672.dbo.UserPrivileg WHERE RU_ID = ru.RU_ID);

-- Check 5: Same for Ecas2668 (working) for comparison
PRINT ''
PRINT '=== Ecas2668 (WORKING) Same checks ==='
PRINT '1. UserData invalid RU_ID:'
SELECT ud.Us_ID, ud.Us_Name, ud.RU_ID FROM Ecas2668.dbo.UserData ud 
WHERE NOT EXISTS (SELECT 1 FROM Ecas2668.dbo.RankUser WHERE RU_ID = ud.RU_ID);
PRINT '4. RankUser rows NOT in UserPrivileg:'
SELECT ru.RU_ID, ru.RU_Name FROM Ecas2668.dbo.RankUser ru 
WHERE ru.RU_ID > 0 AND NOT EXISTS (SELECT 1 FROM Ecas2668.dbo.UserPrivileg WHERE RU_ID = ru.RU_ID);

-- Check 6: Are there any DATA differences in RankUser between 2672 and its backup?
PRINT ''
PRINT '=== RankUser comparison with backup ==='
DECLARE @fl TABLE (LogicalName NVARCHAR(200), PhysicalName NVARCHAR(500), Type CHAR(1), FileGroupName NVARCHAR(200), Size NUMERIC(20), MaxSize NUMERIC(20), FileId INT, CreateLSN NUMERIC(25), DropLSN NUMERIC(25), UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25), ReadWriteLSN NUMERIC(25), BackupSizeInBytes BIGINT, SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25), DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32));
INSERT @fl EXEC('RESTORE FILELISTONLY FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak''');
DECLARE @d NVARCHAR(200), @l NVARCHAR(200);
SELECT @d = LogicalName FROM @fl WHERE Type = 'D'; SELECT @l = LogicalName FROM @fl WHERE Type = 'L';
EXEC('RESTORE DATABASE [RUchk] FROM DISK = N''C:\Temp\ECAS\Ecas2672.bak'' WITH REPLACE, MOVE N''' + @d + ''' TO N''C:\Temp\ECAS\ruchk.mdf'', MOVE N''' + @l + ''' TO N''C:\Temp\ECAS\ruchk.ldf''');

PRINT 'RankUser DIFFERENCES between current and backup:'
SELECT 
    'CUR:' AS src, a.RU_ID, a.RU_Name, a.SFID, a.SEID 
FROM Ecas2672.dbo.RankUser a
WHERE EXISTS (SELECT 1 FROM RUchk.dbo.RankUser b WHERE b.RU_ID = a.RU_ID AND (b.SFID <> a.SFID OR b.SEID <> a.SEID))
UNION ALL
SELECT 'BAK:', b.RU_ID, b.RU_Name, b.SFID, b.SEID 
FROM RUchk.dbo.RankUser b
WHERE EXISTS (SELECT 1 FROM Ecas2672.dbo.RankUser a WHERE b.RU_ID = a.RU_ID AND (b.SFID <> a.SFID OR b.SEID <> a.SEID))
ORDER BY RU_ID, src;

DROP DATABASE RUchk;
"@
Set-Content "C:\Temp\ECAS\int.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\int-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\int.sql -o C:\Temp\ECAS\int-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "INT" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "INT"
Start-Sleep 15
if (Test-Path "C:\Temp\ECAS\int-r.txt") { Get-Content "C:\Temp\ECAS\int-r.txt" }
Unregister-ScheduledTask -TaskName "INT" -Confirm:$false -EA SilentlyContinue
