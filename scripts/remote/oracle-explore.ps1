# Explore Oracle 10g on this machine

Write-Output "=== Oracle Home ==="
$oraHome = Get-ItemProperty 'HKLM:\SOFTWARE\ORACLE\KEY_OraDb10g_home1' -EA SilentlyContinue
if ($oraHome) {
    Write-Output "  ORACLE_HOME: $($oraHome.ORACLE_HOME)"
    Write-Output "  ORACLE_SID: $($oraHome.ORACLE_SID)"
}

Write-Output ""
Write-Output "=== Find sqlplus ==="
$sqlplus = Get-ChildItem 'C:\' -Recurse -Filter sqlplus.exe -Depth 4 -EA SilentlyContinue | Select-Object -First 1
if ($sqlplus) {
    Write-Output "  Found: $($sqlplus.FullName)"
} else {
    Write-Output "  Not found in C:\ (depth 4)"
}

Write-Output ""
Write-Output "=== Oracle Folders ==="
Get-ChildItem 'C:\' -Directory -Depth 1 -EA SilentlyContinue |
    Where-Object { $_.Name -match 'ora' } |
    ForEach-Object { Write-Output "  $($_.FullName)" }

Write-Output ""
Write-Output "=== TNS Listener Status ==="
$lsnrctl = Get-ChildItem 'C:\' -Recurse -Filter lsnrctl.exe -Depth 4 -EA SilentlyContinue | Select-Object -First 1
if ($lsnrctl) {
    $out = & $lsnrctl.FullName status 2>&1 | Out-String
    Write-Output $out
}

Write-Output ""
Write-Output "=== Try sqlplus connection ==="
if ($sqlplus) {
    $env:ORACLE_SID = 'ORCL'
    # Try sys as sysdba
    $result = echo "SELECT username FROM dba_users WHERE account_status='OPEN' ORDER BY username;" | & $sqlplus.FullName -S "/ as sysdba" 2>&1 | Out-String
    Write-Output "--- sys as sysdba ---"
    Write-Output $result
}
