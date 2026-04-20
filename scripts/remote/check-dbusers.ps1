$sql = @"
SET NOCOUNT ON;

PRINT '=== Server-level logins (zuc/zse) ==='
SELECT name, is_disabled, create_date, modify_date, default_database_name
FROM sys.sql_logins 
WHERE name LIKE 'z%' 
ORDER BY name;

PRINT ''
PRINT '=== Database users and their roles ==='
-- For each ECAS database, show users and roles
DECLARE @dbs TABLE(name NVARCHAR(100));
INSERT @dbs VALUES('Ecas2664'),('Ecas2668'),('Ecas2670'),('Ecas2672'),('Ecas2673');
DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @s NVARCHAR(MAX) = '
    SELECT ''' + @db + ''' AS db, 
           u.name AS user_name, 
           l.name AS login_name,
           r.name AS role_name
    FROM [' + @db + '].sys.database_principals u
    LEFT JOIN sys.sql_logins l ON l.sid = u.sid
    LEFT JOIN [' + @db + '].sys.database_role_members rm ON rm.member_principal_id = u.principal_id
    LEFT JOIN [' + @db + '].sys.database_principals r ON r.principal_id = rm.role_principal_id
    WHERE u.type IN (''S'', ''U'') AND u.name NOT IN (''dbo'', ''guest'', ''sys'', ''INFORMATION_SCHEMA'')
    ORDER BY u.name';
    EXEC sp_executesql @s;
    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;

PRINT ''
PRINT '=== Default schema and permissions per database user ==='
-- Check if users have proper DML permissions
DECLARE cur2 CURSOR FOR SELECT name FROM @dbs;
OPEN cur2; FETCH NEXT FROM cur2 INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @s2 NVARCHAR(MAX) = '
    SELECT ''' + @db + ''' AS db, 
           u.name AS user_name,
           u.default_schema_name,
           u.is_fixed_role
    FROM [' + @db + '].sys.database_principals u
    WHERE u.name LIKE ''z%''';
    EXEC sp_executesql @s2;
    FETCH NEXT FROM cur2 INTO @db;
END;
CLOSE cur2; DEALLOCATE cur2;
"@
Set-Content "C:\Temp\ECAS\du.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\du-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\du.sql -o C:\Temp\ECAS\du-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "DU" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "DU"
Start-Sleep 10
if (Test-Path "C:\Temp\ECAS\du-r.txt") { Get-Content "C:\Temp\ECAS\du-r.txt" }
Unregister-ScheduledTask -TaskName "DU" -Confirm:$false -EA SilentlyContinue
