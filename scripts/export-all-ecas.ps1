# Export key tables from ALL 5 ECAS databases
$server = '100.114.106.110,1433'
$user = 'cascade'
$pass = 'Alham@Cascade2026!'
$outDir = 'd:\almham\imports\ecas-data'

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Export-Table {
    param($db, $table, $maxRows = 50000)
    $cs = "Server=$server;Database=$db;User ID=$user;Password=$pass;TrustServerCertificate=true;Connection Timeout=15"
    $outPath = Join-Path $outDir "$db.$table.csv"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT TOP $maxRows * FROM [$table]"
        $cmd.CommandTimeout = 120
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        $adapter.Fill($dt) | Out-Null
        $conn.Close()
        $dt | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8
        Write-Host "OK $db.$table -> $($dt.Rows.Count) rows" -ForegroundColor Green
    } catch {
        Write-Host "FAIL $db.$table -> $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Red
    }
}

$tables = @('Customer','BillAndRaedData','PaymentData','Area','Branch',
            'Squares','TransFormer','LinkPoint','AdadType','FazType',
            'NewSliceDetail','CompInfoAndSysOption','DB_And_Sys_Info',
            'CashierData','CashierSquares','Segel','PersonInfo','RecordState')

$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')

foreach ($db in $dbs) {
    Write-Host "`n=== $db ===" -ForegroundColor Cyan
    foreach ($t in $tables) {
        Export-Table $db $t 20000
    }
}

Write-Host "`nDone! Total files:" -ForegroundColor Cyan
(Get-ChildItem $outDir -Filter *.csv).Count
