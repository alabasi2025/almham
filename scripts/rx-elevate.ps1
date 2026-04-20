# Run a command on remote server as NT AUTHORITY\SYSTEM via scheduled task
# SYSTEM is always sysadmin in SQL Server setups (effectively)

param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Command,

    [string]$Server = '100.114.106.110',
    [int]$Port = 7777,
    [string]$Secret = 'AlhamCascade@2026'
)

$bytes = [System.Text.Encoding]::UTF8.GetBytes($Command)
$b64   = [Convert]::ToBase64String($bytes)
$taskName = 'AlhamSys_' + (Get-Random -Maximum 999999)
$outFile  = 'C:\Windows\Temp\' + $taskName + '.txt'
$scriptFile = 'C:\Windows\Temp\' + $taskName + '.ps1'

# This block runs on the remote server: writes script, schedules as SYSTEM, runs, waits, reads, cleans up
$remote = @"
`$cmd = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64'));
`$scriptContent = @'
`$ErrorActionPreference = 'Continue';
try { __CMD__ 2>&1 | Out-String | Set-Content -Path '$outFile' -Encoding UTF8 } catch { Set-Content '$outFile' `$_.Exception.Message }
'@
`$scriptContent = `$scriptContent.Replace('__CMD__', `$cmd);
Set-Content -Path '$scriptFile' -Value `$scriptContent -Encoding UTF8;
schtasks /create /tn '$taskName' /tr 'powershell.exe -ExecutionPolicy Bypass -File $scriptFile' /sc once /st 23:59 /ru SYSTEM /rl HIGHEST /f | Out-Null;
schtasks /run /tn '$taskName' | Out-Null;
`$attempts = 0;
while ((-not (Test-Path '$outFile')) -and `$attempts -lt 30) { Start-Sleep -Milliseconds 500; `$attempts++ }
Start-Sleep -Seconds 2;
if (Test-Path '$outFile') { Get-Content '$outFile' -Raw -Encoding UTF8 } else { Write-Output '(no output file)' }
schtasks /delete /tn '$taskName' /f 2>&1 | Out-Null;
Remove-Item '$scriptFile' -ErrorAction SilentlyContinue;
Remove-Item '$outFile' -ErrorAction SilentlyContinue;
"@

$rx = Join-Path $PSScriptRoot 'rx.ps1'
& $rx -Server $Server -Port $Port -Secret $Secret $remote
