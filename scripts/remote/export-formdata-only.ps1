# Export FormData to file
$cs = "Server=localhost;Database=Ecas2670;Integrated Security=true;TrustServerCertificate=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM FormData ORDER BY Frm_ID"
$rd = $cmd.ExecuteReader()
$cols = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) { $cols += $rd.GetName($i) }
$lines = @("COLUMNS: $($cols -join ' | ')")
$lines += ""
while ($rd.Read()) {
    $vals = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) {
        $v = $rd.GetValue($i)
        if ($v -is [DBNull]) { $vals += '' } else { $vals += $v.ToString() }
    }
    $lines += ($vals -join ' | ')
}
$rd.Close()
$conn.Close()
$lines -join "`n" | Write-Output
