$sql = @"
SET NOCOUNT ON;
SELECT name, is_disabled, LOGINPROPERTY(name,'IsLocked') as locked, LOGINPROPERTY(name,'BadPasswordCount') as bad_pw, LOGINPROPERTY(name,'PasswordLastSetTime') as pw_set FROM sys.sql_logins;

-- Also check default trace for recent events
SELECT TOP 20 EventClass, TextData, LoginName, StartTime FROM fn_trace_gettable((SELECT path FROM sys.traces WHERE is_default = 1), DEFAULT) WHERE StartTime > DATEADD(hour, -6, GETDATE()) AND EventClass IN (20, 46, 47) ORDER BY StartTime DESC;
"@
Set-Content 'C:\Temp\ECAS\sa.sql' $sql -Encoding ASCII
Remove-Item 'C:\Temp\ECAS\sa-result.txt' -Force -EA SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c sqlcmd -S localhost -E -i "C:\Temp\ECAS\sa.sql" -o "C:\Temp\ECAS\sa-result.txt" -W'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'ChkSA' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'ChkSA'
Start-Sleep 8
if (Test-Path 'C:\Temp\ECAS\sa-result.txt') { Get-Content 'C:\Temp\ECAS\sa-result.txt' }
Unregister-ScheduledTask -TaskName 'ChkSA' -Confirm:$false -EA SilentlyContinue
