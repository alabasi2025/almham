# Export key ECAS tables to CSV via Tailscale
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
        Write-Host "OK: $db.$table -> $($dt.Rows.Count) rows -> $outPath" -ForegroundColor Green
    } catch {
        Write-Host "FAIL: $db.$table -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Export from first database as sample
$db = 'Ecas2664'
Write-Host "Exporting from $db..." -ForegroundColor Cyan

Export-Table $db 'Customer'
Export-Table $db 'Customers_Info'
Export-Table $db 'BillAndRaedData' 10000
Export-Table $db 'PaymentData' 10000
Export-Table $db 'Area'
Export-Table $db 'Branch'
Export-Table $db 'Squares'
Export-Table $db 'TransFormer'
Export-Table $db 'LinkPoint'
Export-Table $db 'AdadType'
Export-Table $db 'FazType'
Export-Table $db 'NewSliceDetail'
Export-Table $db 'CompInfoAndSysOption'
Export-Table $db 'DB_And_Sys_Info'

Write-Host "`nDone! Files in: $outDir" -ForegroundColor Cyan
