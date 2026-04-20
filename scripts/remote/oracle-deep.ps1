# Find all Oracle installations and connect

Write-Output "=== All Oracle Registry Keys ==="
Get-ChildItem 'HKLM:\SOFTWARE\ORACLE' -Recurse -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    $oh = $props.ORACLE_HOME
    $sid = $props.ORACLE_SID
    if ($oh -or $sid) {
        Write-Output "  KEY: $($_.PSChildName)"
        Write-Output "    ORACLE_HOME = $oh"
        Write-Output "    ORACLE_SID  = $sid"
    }
}
Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\ORACLE' -Recurse -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    $oh = $props.ORACLE_HOME
    $sid = $props.ORACLE_SID
    if ($oh -or $sid) {
        Write-Output "  KEY(WOW): $($_.PSChildName)"
        Write-Output "    ORACLE_HOME = $oh"
        Write-Output "    ORACLE_SID  = $sid"
    }
}

Write-Output ""
Write-Output "=== All sqlplus.exe files ==="
Get-ChildItem 'C:\' -Recurse -Filter sqlplus.exe -Depth 5 -EA SilentlyContinue | ForEach-Object {
    Write-Output "  $($_.FullName) ($([math]::Round($_.Length/1KB)) KB)"
}

Write-Output ""
Write-Output "=== Try connect with ORACLE_SID=ORCL ==="
$env:ORACLE_SID = 'ORCL'
$env:ORACLE_HOME = 'C:\orant'

# Find the newest sqlplus
$sp = Get-ChildItem 'C:\' -Recurse -Filter sqlplus.exe -Depth 5 -EA SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($sp) {
    Write-Output "Using: $($sp.FullName)"
    $query = @"
SET PAGESIZE 100
SET LINESIZE 200
SELECT username, account_status FROM dba_users WHERE account_status='OPEN' ORDER BY username;
EXIT;
"@
    $query | & $sp.FullName -S "/ as sysdba" 2>&1 | Out-String | Write-Output
}

Write-Output ""
Write-Output "=== Oracle listener port check ==="
Get-NetTCPConnection -State Listen -EA SilentlyContinue |
    Where-Object { $_.LocalPort -in 1521,1522,1523,5560,5500 } |
    ForEach-Object { Write-Output "  Port $($_.LocalPort) = PID $($_.OwningProcess)" }
