$sql = @"
SET NOCOUNT ON;
-- Compare DB_PassWord as hex bytes for exact comparison
DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2664'),('Ecas2668'),('Ecas2670'),('Ecas2672'),('Ecas2673');
DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @s NVARCHAR(MAX) = 'SELECT ''' + @db + ''' as db, CONVERT(VARBINARY(100), DB_PassWord) as pw_hex, DB_PassWord, DB_SysEXEName, DB_Version, noal FROM [' + @db + '].dbo.DB_And_Sys_Info';
    EXEC sp_executesql @s;
    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
"@
Set-Content 'C:\Temp\ECAS\pw.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\pw-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\pw.sql" -o "C:\Temp\ECAS\pw-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'PW' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'PW'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\pw-result.txt') { Get-Content 'C:\Temp\ECAS\pw-result.txt' }
Unregister-ScheduledTask -TaskName 'PW' -Confirm:$false -EA SilentlyContinue
