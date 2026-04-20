$sql = @"
SET NOCOUNT ON;

PRINT '=== All triggers in Ecas2672 ==='
SELECT name, type_desc, is_disabled, parent_class_desc, OBJECT_NAME(parent_id) AS parent_object 
FROM Ecas2672.sys.triggers 
WHERE is_ms_shipped = 0
ORDER BY parent_class, name;

PRINT ''
PRINT '=== All triggers in Ecas2668 (working) ==='
SELECT name, type_desc, is_disabled, parent_class_desc, OBJECT_NAME(parent_id) AS parent_object 
FROM Ecas2668.sys.triggers 
WHERE is_ms_shipped = 0
ORDER BY parent_class, name;

PRINT ''
PRINT '=== Try UPDATE RankUser SET SFID in Ecas2672 (as test) ==='
DECLARE @old_sfid BIGINT;
SELECT @old_sfid = SFID FROM Ecas2672.dbo.RankUser WHERE RU_ID = 2;
PRINT 'Current SFID for RU_ID=2: ' + CAST(@old_sfid AS VARCHAR);
BEGIN TRY
    UPDATE Ecas2672.dbo.RankUser SET SFID = @old_sfid WHERE RU_ID = 2;
    PRINT 'UPDATE SUCCESS';
END TRY
BEGIN CATCH
    PRINT 'UPDATE FAILED: ' + ERROR_MESSAGE();
END CATCH;
"@
Set-Content "C:\Temp\ECAS\trg.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\trg-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\trg.sql -o C:\Temp\ECAS\trg-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "TRG" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "TRG"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\trg-r.txt") { Get-Content "C:\Temp\ECAS\trg-r.txt" }
Unregister-ScheduledTask -TaskName "TRG" -Confirm:$false -EA SilentlyContinue
