# Restore ErrorTable from CSV backup data
# Read Ecas2664 ErrorTable CSV and insert back into ALL databases

$csv = Import-Csv 'd:\almham\imports\ecas-full\Ecas2664\ErrorTable.csv'
Write-Host "Loaded $($csv.Count) error rows from backup"

$server = '100.114.106.110,1433'
$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')

foreach ($db in $dbs) {
    $cs = "Server=$server;Database=$db;User ID=cascade;Password=Alham@Cascade2026!;TrustServerCertificate=true;Connection Timeout=10"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $conn.Open()

        # Check current count
        $cmd0 = $conn.CreateCommand()
        $cmd0.CommandText = "SELECT COUNT(*) FROM ErrorTable"
        $cnt = $cmd0.ExecuteScalar()
        Write-Host "$db : currently $cnt rows"

        if ($cnt -eq 0) {
            foreach ($row in $csv) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = "SET QUOTED_IDENTIFIER ON; INSERT INTO ErrorTable (Er_No, Er_Location, Er_Description, Er_DateTime, tBrnIDForDelTempErrores) VALUES (@n, @l, @d, @dt, @b)"
                $cmd.Parameters.AddWithValue('@n', [int]$row.Er_No) | Out-Null
                $cmd.Parameters.AddWithValue('@l', $row.Er_Location) | Out-Null
                $cmd.Parameters.AddWithValue('@d', $row.Er_Description) | Out-Null
                $cmd.Parameters.AddWithValue('@dt', [datetime]$row.Er_DateTime) | Out-Null
                $cmd.Parameters.AddWithValue('@b', $row.tBrnIDForDelTempErrores) | Out-Null
                $cmd.ExecuteNonQuery() | Out-Null
            }
            Write-Host "  Restored $($csv.Count) rows" -ForegroundColor Green
        } else {
            Write-Host "  Skipped (already has data)" -ForegroundColor Yellow
        }
        $conn.Close()
    } catch {
        Write-Host "  $db FAIL: $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Red
    }
}
