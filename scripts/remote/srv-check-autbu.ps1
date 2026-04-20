$query = @"
-- Check adbc/bdbc vs DB name
SELECT DB='2668', adbc, bdbc, DB_Name FROM Ecas2668.dbo.DB_And_Sys_Info
UNION ALL SELECT '2672', adbc, bdbc, DB_Name FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL SELECT '2673', adbc, bdbc, DB_Name FROM Ecas2673.dbo.DB_And_Sys_Info
GO

-- Check Branch Brn_DBName vs adbc
SELECT DB='2668', Brn_ID, Brn_DBName, Brn_DBPassWord FROM Ecas2668.dbo.Branch
UNION ALL SELECT '2672', Brn_ID, Brn_DBName, Brn_DBPassWord FROM Ecas2672.dbo.Branch
UNION ALL SELECT '2673', Brn_ID, Brn_DBName, Brn_DBPassWord FROM Ecas2673.dbo.Branch
GO

-- esy.exe output test
EXEC xp_cmdshell 'cd /d "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\ExeRef" && esy.exe'
GO
"@

$query | Out-File "C:\chk.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\chk.sql" -o "C:\chk_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasChk" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasChk" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasChk"; Start-Sleep 10
Get-Content "C:\chk_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasChk" -Confirm:$false -ErrorAction SilentlyContinue

# Check ECAS_AllSys_AotuBU folder
Write-Host "=== ECAS_AllSys_AotuBU folders ==="
Get-ChildItem "E:\" -Directory | Where-Object { $_.Name -like "*AotuBU*" -or $_.Name -like "*Auto*" } | ForEach-Object {
    $files = Get-ChildItem $_.FullName -Filter "*.dbf" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5
    Write-Host ("  " + $_.FullName)
    $files | ForEach-Object { Write-Host ("    " + $_.Name + " | " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")) }
}
