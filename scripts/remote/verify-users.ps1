# Verify UserData in all databases
$sql = @"
EXEC sp_MSforeachdb 'IF ''?'' LIKE ''Ecas%'' SELECT ''?'' as db, Us_ID, Us_Name, Us_PassWord FROM [?].dbo.UserData ORDER BY Us_ID';
"@
Set-Content 'C:\Temp\ECAS\verify.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\verify-result.txt' -Force -EA SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\verify.sql" -o "C:\Temp\ECAS\verify-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'VerifyUD' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'VerifyUD'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\verify-result.txt') { Get-Content 'C:\Temp\ECAS\verify-result.txt' }
Unregister-ScheduledTask -TaskName 'VerifyUD' -Confirm:$false -EA SilentlyContinue
