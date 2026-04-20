# List tables in DATAALA and DATASOG schemas
$env:ORACLE_HOME = 'd:\oracle\product\10.2.0\db_1'
$env:ORACLE_SID = 'orcl'
$sp = "$env:ORACLE_HOME\BIN\sqlplus.exe"

$q = @"
SET PAGESIZE 500
SET LINESIZE 200
SET HEADING ON

PROMPT === DATAALA Tables (top 30 by rows) ===
SELECT * FROM (SELECT table_name, num_rows FROM dba_tables WHERE owner='DATAALA' AND num_rows > 0 ORDER BY num_rows DESC) WHERE ROWNUM <= 30;

PROMPT
PROMPT === DATASOG Tables (top 30 by rows) ===
SELECT * FROM (SELECT table_name, num_rows FROM dba_tables WHERE owner='DATASOG' AND num_rows > 0 ORDER BY num_rows DESC) WHERE ROWNUM <= 30;

EXIT;
"@

$q | & $sp -S "/ as sysdba" 2>&1 | Out-String | Write-Output
