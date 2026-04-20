# Test local SQL Express databases
$cs = "Server=.\SQLEXPRESS;Integrated Security=true;TrustServerCertificate=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name, state_desc FROM sys.databases WHERE database_id > 4"
$rd = $cmd.ExecuteReader()
while ($rd.Read()) {
    Write-Host "$($rd.GetValue(0)) = $($rd.GetValue(1))"
}
$rd.Close()

# Try querying Ecas2664
try {
    $cmd2 = $conn.CreateCommand()
    $cmd2.CommandText = "SELECT COUNT(*) FROM Ecas2664.dbo.Customer"
    $cnt = $cmd2.ExecuteScalar()
    Write-Host "Ecas2664 Customers: $cnt" -ForegroundColor Green
} catch {
    Write-Host "Ecas2664 query error: $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Red
}

$conn.Close()
