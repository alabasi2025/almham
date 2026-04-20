$query = @"
-- Temporarily set 2672 admin password to "123" same as working 2668
-- This is a TEST ONLY to confirm if password is the cause
UPDATE Ecas2672.dbo.UserData SET Us_PassWord = '123' WHERE RU_ID = 2;
SELECT 'Ecas2672 admin PW set to 123 for testing';
GO

UPDATE Ecas2673.dbo.UserData SET Us_PassWord = '123' WHERE RU_ID = 2;
SELECT 'Ecas2673 admin PW set to 123 for testing';
GO

-- Verify
SELECT DB='2668', RU_ID, Us_Name, Us_PassWord FROM Ecas2668.dbo.UserData WHERE RU_ID=2
UNION ALL SELECT '2672', RU_ID, Us_Name, Us_PassWord FROM Ecas2672.dbo.UserData WHERE RU_ID=2
UNION ALL SELECT '2673', RU_ID, Us_Name, Us_PassWord FROM Ecas2673.dbo.UserData WHERE RU_ID=2
GO
"@

$query | Out-File "C:\test_pw.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\test_pw.sql" -o "C:\test_pw_out.txt" -W -s "|"'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasTestPW" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasTestPW" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasTestPW"; Start-Sleep 8
Get-Content "C:\test_pw_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasTestPW" -Confirm:$false -ErrorAction SilentlyContinue
