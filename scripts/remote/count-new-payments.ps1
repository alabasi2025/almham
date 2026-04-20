$sql = @"
SET NOCOUNT ON;

PRINT '=== Payments AFTER backup time (8:45 AM today) ==='

-- Ecas2672
SELECT 'Ecas2672' AS db, COUNT(*) AS new_payments_mobile, SUM(CAST(Pay_Mony AS DECIMAL(18,2))) AS total_amount
FROM Ecas2672.dbo.PaymentData
WHERE Pay_InsertDate >= '2026-04-19 08:45:00'
   OR Pay_UpDateDate >= '2026-04-19 08:45:00';

-- Ecas2673
SELECT 'Ecas2673' AS db, COUNT(*) AS new_payments_mobile, SUM(CAST(Pay_Mony AS DECIMAL(18,2))) AS total_amount
FROM Ecas2673.dbo.PaymentData
WHERE Pay_InsertDate >= '2026-04-19 08:45:00'
   OR Pay_UpDateDate >= '2026-04-19 08:45:00';

-- Show actual new rows
PRINT ''
PRINT '=== New payments for Ecas2672 (detail) ==='
SELECT TOP 5 Pay_No, Cst_Name, Pay_Mony, Pay_InsertDate, Pay_UserName
FROM Ecas2672.dbo.PaymentData
WHERE Pay_InsertDate >= '2026-04-19 08:45:00'
ORDER BY Pay_InsertDate DESC;

PRINT ''
PRINT '=== New payments for Ecas2673 (detail) ==='
SELECT TOP 5 Pay_No, Cst_Name, Pay_Mony, Pay_InsertDate, Pay_UserName
FROM Ecas2673.dbo.PaymentData
WHERE Pay_InsertDate >= '2026-04-19 08:45:00'
ORDER BY Pay_InsertDate DESC;
"@
Set-Content "C:\Temp\ECAS\np.sql" $sql -Encoding ASCII
Remove-Item "C:\Temp\ECAS\np-r.txt" -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c sqlcmd -S localhost -E -i C:\Temp\ECAS\np.sql -o C:\Temp\ECAS\np-r.txt -W"
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "NP" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "NP"
Start-Sleep 8
if (Test-Path "C:\Temp\ECAS\np-r.txt") { Get-Content "C:\Temp\ECAS\np-r.txt" }
Unregister-ScheduledTask -TaskName "NP" -Confirm:$false -EA SilentlyContinue
