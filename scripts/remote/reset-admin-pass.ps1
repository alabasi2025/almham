# Reset Administrator password to '123' in all ECAS databases
$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')
foreach ($db in $dbs) {
    $cs = "Server=localhost;Database=$db;Integrated Security=true;TrustServerCertificate=true"
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "UPDATE UserData SET Us_PassWord = '123' WHERE Us_ID = -1"
    $rows = $cmd.ExecuteNonQuery()
    Write-Output "$db : $rows row updated"
    $conn.Close()
}
