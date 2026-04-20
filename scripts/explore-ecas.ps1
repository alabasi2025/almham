# Explore ECAS databases via Tailscale using cascade login
$server = '100.114.106.110,1433'
$cs = "Server=$server;User ID=cascade;Password=Alham@Cascade2026!;TrustServerCertificate=true;Connection Timeout=10"

function Run-Query {
    param($connStr, $db, $query)
    $c = New-Object System.Data.SqlClient.SqlConnection("$connStr;Database=$db")
    $c.Open()
    $cmd = $c.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 30
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null
    $c.Close()
    return $dt
}

# List all ECAS databases
$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')

$outFile = 'd:\almham\imports\ecas-schema.txt'
$lines = @()

foreach ($db in $dbs) {
    $lines += ""
    $lines += "========================================"
    $lines += " DATABASE: $db"
    $lines += "========================================"

    $tables = Run-Query $cs $db "SELECT t.TABLE_NAME, p.[rows] FROM INFORMATION_SCHEMA.TABLES t JOIN sys.partitions p ON OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME) = p.object_id AND p.index_id IN (0,1) WHERE t.TABLE_TYPE = 'BASE TABLE' ORDER BY p.[rows] DESC"

    $lines += "  Tables: $($tables.Rows.Count)"
    $lines += ""
    foreach ($row in $tables.Rows) {
        $name = $row[0].ToString()
        $cnt  = $row[1].ToString()
        $lines += "  $name | $cnt"
    }
}

$lines | Out-File $outFile -Encoding UTF8
Write-Host "Saved to $outFile ($($lines.Count) lines)"
