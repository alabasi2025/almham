$sql = @"
SET NOCOUNT ON;

PRINT '=== PRIMARY KEY / Unique Constraints on UserPrivileg ==='
SELECT DB_NAME() AS db, i.name AS index_name, i.is_primary_key, i.is_unique, 
       STUFF((SELECT ', ' + c.name FROM Ecas2672.sys.index_columns ic2 
              JOIN Ecas2672.sys.columns c ON c.object_id=ic2.object_id AND c.column_id=ic2.column_id 
              WHERE ic2.index_id=i.index_id AND ic2.object_id=i.object_id 
              ORDER BY ic2.key_ordinal FOR XML PATH('')),1,2,'') AS columns
FROM Ecas2672.sys.indexes i 
WHERE i.object_id = OBJECT_ID('Ecas2672.dbo.UserPrivileg') AND (i.is_primary_key=1 OR i.is_unique=1);

PRINT '=== Check for ANY locks on tbu directory ==='
-- Simulate what ECAS does
USE Ecas2672;
PRINT '=== Try the actual CheckUserPrivileg flow ==='

-- The app probably starts with:
-- 1. DELETE FROM UserPrivileg WHERE RU_ID = @rank
BEGIN TRY
    BEGIN TRAN
    DECLARE @deleted INT;
    DELETE FROM Ecas2672.dbo.UserPrivileg WHERE RU_ID = 2;
    SET @deleted = @@ROWCOUNT;
    PRINT 'Deleted from UserPrivileg: ' + CAST(@deleted AS VARCHAR);
    
    -- 2. Re-INSERT based on FormRankUser × FormEvent
    DECLARE @inserted INT;
    INSERT INTO Ecas2672.dbo.UserPrivileg (RU_ID, Frm_ID, Evn_ID)
    SELECT fr.RU_ID, fr.Frm_ID, fe.Evn_ID
    FROM Ecas2672.dbo.FormRankUser fr
    INNER JOIN Ecas2672.dbo.FormEvent fe ON fr.Frm_ID = fe.Frm_ID
    WHERE fr.RU_ID = 2;
    SET @inserted = @@ROWCOUNT;
    PRINT 'Inserted to UserPrivileg: ' + CAST(@inserted AS VARCHAR);
    
    ROLLBACK TRAN;
    PRINT 'ROLLED BACK - no actual change';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
END CATCH;
"@
Set-Content "C:\Temp\ECAS\pk.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\pk-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\pk.sql -o C:\Temp\ECAS\pk-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "PK" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "PK"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\pk-r.txt") { Get-Content "C:\Temp\ECAS\pk-r.txt" }
Unregister-ScheduledTask -TaskName "PK" -Confirm:$false -EA SilentlyContinue
