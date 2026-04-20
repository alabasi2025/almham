# FULL export: ALL tables, ALL columns, ALL rows from ALL ECAS databases
$server = '100.114.106.110,1433'
$user = 'cascade'
$pass = 'Alham@Cascade2026!'
$outDir = 'd:\almham\imports\ecas-full'

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')
$totalFiles = 0
$totalRows = 0

foreach ($db in $dbs) {
    Write-Host "`n========== $db ==========" -ForegroundColor Cyan
    $dbDir = Join-Path $outDir $db
    New-Item -ItemType Directory -Path $dbDir -Force | Out-Null

    $cs = "Server=$server;Database=$db;User ID=$user;Password=$pass;TrustServerCertificate=true;Connection Timeout=15"
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()

    # Get all table names
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    $rd = $cmd.ExecuteReader()
    $tables = @()
    while ($rd.Read()) { $tables += $rd.GetString(0) }
    $rd.Close()

    Write-Host "  $($tables.Count) tables to export" -ForegroundColor White

    foreach ($t in $tables) {
        $outPath = Join-Path $dbDir "$t.csv"
        try {
            $cmd2 = $conn.CreateCommand()
            $cmd2.CommandText = "SELECT * FROM [$t]"
            $cmd2.CommandTimeout = 300
            $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd2)
            $dt = New-Object System.Data.DataTable
            $adapter.Fill($dt) | Out-Null
            $dt | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8
            $rows = $dt.Rows.Count
            $totalRows += $rows
            $totalFiles++
            if ($rows -gt 0) {
                Write-Host "  OK $t -> $rows" -ForegroundColor Green
            }
        } catch {
            Write-Host "  FAIL $t -> $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Red
        }
    }

    $conn.Close()
}

Write-Host "`n=============================" -ForegroundColor Cyan
Write-Host "TOTAL: $totalFiles files, $totalRows rows" -ForegroundColor Cyan
Write-Host "Location: $outDir" -ForegroundColor Cyan
