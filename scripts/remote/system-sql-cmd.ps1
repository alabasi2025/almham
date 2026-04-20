# Step 1: Write SQL to fix logins + export cert + change password
$sql = @"
BACKUP CERTIFICATE [Ecas0To9_Clit_Certificate] TO FILE = 'C:\Temp\ECAS\TDECert.cer'
WITH PRIVATE KEY (FILE = 'C:\Temp\ECAS\TDECert.pvk', ENCRYPTION BY PASSWORD = 'Alham@CertKey2026!');
BACKUP SERVICE MASTER KEY TO FILE = 'C:\Temp\ECAS\SMK.bak' ENCRYPTION BY PASSWORD = 'Alham@CertKey2026!';
BACKUP MASTER KEY TO FILE = 'C:\Temp\ECAS\DMK.bak' ENCRYPTION BY PASSWORD = 'Alham@CertKey2026!';
PRINT 'CERTIFICATES EXPORTED';
"@
Set-Content 'C:\Temp\ECAS\fix.sql' $sql -Encoding ASCII

# Step 2: Write batch file
Set-Content 'C:\Temp\ECAS\run.bat' 'sqlcmd -S localhost -E -i "C:\Temp\ECAS\fix.sql" -o "C:\Temp\ECAS\result.txt" -W' -Encoding ASCII

# Step 3: Remove old result
Remove-Item 'C:\Temp\ECAS\result.txt' -Force -EA SilentlyContinue

# Step 4: Run as SYSTEM
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c C:\Temp\ECAS\run.bat'
$principal = New-ScheduledTaskPrincipal -UserID "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'AlhamFix' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'AlhamFix'
Start-Sleep 8

# Step 5: Read result
if (Test-Path 'C:\Temp\ECAS\result.txt') { Get-Content 'C:\Temp\ECAS\result.txt' }
else { Write-Output 'No result yet'; Start-Sleep 5; if (Test-Path 'C:\Temp\ECAS\result.txt') { Get-Content 'C:\Temp\ECAS\result.txt' } }

Unregister-ScheduledTask -TaskName 'AlhamFix' -Confirm:$false -EA SilentlyContinue
