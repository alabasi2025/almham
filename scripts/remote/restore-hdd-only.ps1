# ONLY restore HardDiskDrivesInfo - nothing else
net stop MSSQLSERVER /y
Start-Sleep 3
cmd /c "net start MSSQLSERVER /m"
Start-Sleep 5

$sql = @"
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @db NVARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM sys.databases WHERE name LIKE 'Ecas%';
OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('INSERT INTO [' + @db + '].dbo.HardDiskDrivesInfo (pNo,DriverName,DriverType,CapacityGB,SerialNumber_Dec,SerialNumber_Hex,VolumeName,FileSysName) VALUES (1,''C:\'',''Drive Fixed'',''140.13'',''-29550678'',''FE3D17AA'',''C_WinSrv2016'',''NTFS''),(2,''D:\'',''Drive Fixed'',''120.11'',''509712464'',''1E619850'',''Ecas_Web'',''NTFS''),(3,''E:\'',''Drive Fixed'',''205.51'',''581032464'',''22A1DA10'',''For System Only'',''NTFS'')');
    FETCH NEXT FROM cur INTO @db;
END;
CLOSE cur; DEALLOCATE cur;
PRINT 'HardDiskDrivesInfo restored in all databases';
"@
Set-Content 'C:\Temp\ECAS\hdd.sql' $sql -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\hdd.sql" -o "C:\Temp\ECAS\hdd-result.txt"'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'RestoreHDD' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'RestoreHDD'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\hdd-result.txt') { Get-Content 'C:\Temp\ECAS\hdd-result.txt' }
Unregister-ScheduledTask -TaskName 'RestoreHDD' -Confirm:$false -EA SilentlyContinue

net stop MSSQLSERVER /y
Start-Sleep 2
net start MSSQLSERVER
Write-Output 'DONE'
