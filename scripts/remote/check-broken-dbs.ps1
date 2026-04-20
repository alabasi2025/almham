# Compare working DB (Ecas2668) vs broken ones (Ecas2672, Ecas2673)
$sql = @"
SET NOCOUNT ON;

-- Check ErrorTable for spy-related entries
PRINT '=== Ecas2672 ErrorTable ==='
SELECT TOP 10 Er_No, Er_Location, LEFT(Er_Description, 100) as Desc_Short, Er_DateTime FROM Ecas2672.dbo.ErrorTable ORDER BY Er_DateTime DESC;

PRINT '=== Ecas2673 ErrorTable ==='
SELECT TOP 10 Er_No, Er_Location, LEFT(Er_Description, 100) as Desc_Short, Er_DateTime FROM Ecas2673.dbo.ErrorTable ORDER BY Er_DateTime DESC;

PRINT '=== Ecas2668 ErrorTable (working) ==='
SELECT TOP 5 Er_No, Er_Location, LEFT(Er_Description, 100) as Desc_Short, Er_DateTime FROM Ecas2668.dbo.ErrorTable ORDER BY Er_DateTime DESC;

-- Compare DB_And_Sys_Info
PRINT '=== DB_And_Sys_Info comparison ==='
SELECT 'Ecas2668' as db, noal FROM Ecas2668.dbo.DB_And_Sys_Info
UNION ALL
SELECT 'Ecas2672', noal FROM Ecas2672.dbo.DB_And_Sys_Info
UNION ALL
SELECT 'Ecas2673', noal FROM Ecas2673.dbo.DB_And_Sys_Info;
"@
Set-Content 'C:\Temp\ECAS\chkb.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\chkb-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\chkb.sql" -o "C:\Temp\ECAS\chkb-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'ChkB' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'ChkB'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\chkb-result.txt') { Get-Content 'C:\Temp\ECAS\chkb-result.txt' }
Unregister-ScheduledTask -TaskName 'ChkB' -Confirm:$false -EA SilentlyContinue
