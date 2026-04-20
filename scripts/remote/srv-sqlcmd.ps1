$sql = @"
SELECT 'Ecas2668' AS DB, db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2668.dbo.CompInfoAndSysOption
UNION ALL
SELECT 'Ecas2672' AS DB, db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2672.dbo.CompInfoAndSysOption
UNION ALL
SELECT 'Ecas2673' AS DB, db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup FROM Ecas2673.dbo.CompInfoAndSysOption
"@

$sql | Out-File "C:\q.sql" -Encoding UTF8
$result = & sqlcmd -S localhost -E -i "C:\q.sql" -W -s "|" 2>&1
$result

Write-Host ""
Write-Host "=== DB_And_Sys_Info ==="
$sql2 = "SELECT 'Ecas2668' AS DB, noal, DB_Name FROM Ecas2668.dbo.DB_And_Sys_Info UNION ALL SELECT 'Ecas2672', noal, DB_Name FROM Ecas2672.dbo.DB_And_Sys_Info UNION ALL SELECT 'Ecas2673', noal, DB_Name FROM Ecas2673.dbo.DB_And_Sys_Info"
$sql2 | Out-File "C:\q2.sql" -Encoding UTF8
& sqlcmd -S localhost -E -i "C:\q2.sql" -W -s "|" 2>&1

Write-Host ""
Write-Host "=== Backup path exists check ==="
foreach ($path in @("E:\","D:\","C:\")) {
    Write-Host ("$path -> exists: " + (Test-Path $path))
}

Write-Host ""
Write-Host "=== .dbf files today ==="
$drives = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root
foreach ($d in $drives) {
    Get-ChildItem $d -Filter "*.dbf" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime.Date -ge (Get-Date).Date.AddDays(-1) } | ForEach-Object {
        Write-Host ("  " + $_.FullName + " | " + [math]::Round($_.Length/1MB,1) + "MB | " + $_.LastWriteTime)
    }
}
