# Map each ECAS database to its station name
$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')
foreach ($db in $dbs) {
    $cs = "Server=localhost;Database=$db;User ID=cascade;Password=Alham@Cascade2026!;TrustServerCertificate=true"
    $c = New-Object System.Data.SqlClient.SqlConnection($cs)
    $c.Open()
    $cmd = $c.CreateCommand()
    $cmd.CommandText = "SELECT TOP 1 Ar_Name FROM Area"
    $r = $cmd.ExecuteReader()
    $name = if ($r.Read()) { $r.GetValue(0).ToString() } else { '?' }
    $r.Close()
    $cmd2 = $c.CreateCommand()
    $cmd2.CommandText = "SELECT COUNT(*) FROM Customer"
    $cnt = $cmd2.ExecuteScalar()
    $c.Close()
    Write-Output "$db = $name ($cnt customers)"
}
