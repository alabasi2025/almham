# Connect to Oracle 10g with correct ORACLE_HOME

$env:ORACLE_HOME = 'd:\oracle\product\10.2.0\db_1'
$env:ORACLE_SID = 'orcl'
$env:PATH = "$env:ORACLE_HOME\BIN;$env:PATH"

$sp = "$env:ORACLE_HOME\BIN\sqlplus.exe"
Write-Output "sqlplus exists: $(Test-Path $sp)"

if (Test-Path $sp) {
    Write-Output ""
    Write-Output "=== Oracle Users ==="
    $q1 = "SET PAGESIZE 200`nSET LINESIZE 200`nSELECT username, account_status, default_tablespace FROM dba_users ORDER BY username;`nEXIT;"
    $q1 | & $sp -S "/ as sysdba" 2>&1 | Out-String | Write-Output

    Write-Output ""
    Write-Output "=== Non-system Schemas with Tables ==="
    $q2 = "SET PAGESIZE 200`nSET LINESIZE 200`nSELECT owner, COUNT(*) as tbl_count FROM dba_tables WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','MDSYS','ORDSYS','CTXSYS','XDB','DMSYS','OLAPSYS','WMSYS','EXFSYS','DBSNMP','TSMSYS','FLOWS_FILES','FLOWS_020100','APPQOSSYS') GROUP BY owner ORDER BY tbl_count DESC;`nEXIT;"
    $q2 | & $sp -S "/ as sysdba" 2>&1 | Out-String | Write-Output
}
