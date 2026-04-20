# Run sqlcmd as SYSTEM to bypass disabled login
# 1. Stop SQL, start single-user
net stop MSSQLSERVER /y 2>&1 | Out-Null
Start-Sleep 2
cmd /c 'net start MSSQLSERVER /m'
Start-Sleep 5

# 2. Create scheduled task to run as SYSTEM
$sql = "ALTER LOGIN [ABBASIYSERVER\Mohammed] ENABLE; ALTER LOGIN [cascade] ENABLE; UPDATE Ecas2670.dbo.UserData SET Us_PassWord = '123' WHERE Us_ID = -1; SELECT 'DONE' as result"
$action = New-ScheduledTaskAction -Execute 'sqlcmd.exe' -Argument "-S localhost -E -Q `"$sql`" -o C:\Temp\sqlfix.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'AlhamSQLFix' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'AlhamSQLFix'
Start-Sleep 8

# 3. Read result
if (Test-Path 'C:\Temp\sqlfix.txt') {
    Get-Content 'C:\Temp\sqlfix.txt'
} else {
    Write-Output 'No output file created'
}

# 4. Cleanup and restart normally
Unregister-ScheduledTask -TaskName 'AlhamSQLFix' -Confirm:$false -EA SilentlyContinue
net stop MSSQLSERVER /y 2>&1 | Out-Null
Start-Sleep 2
net start MSSQLSERVER 2>&1 | Out-Null
Write-Output 'SQL restarted normally'
