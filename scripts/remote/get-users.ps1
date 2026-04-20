# Get all users from all 5 ECAS databases
$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')
foreach ($db in $dbs) {
    $cs = "Server=localhost;Database=$db;Integrated Security=true;TrustServerCertificate=true"
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()

    # Area name
    $cmd0 = $conn.CreateCommand()
    $cmd0.CommandText = "SELECT TOP 1 Ar_Name FROM Area"
    $area = $cmd0.ExecuteScalar().ToString()

    Write-Output "=== $db ($area) ==="

    # Users
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM UserData ORDER BY Us_ID"
    $rd = $cmd.ExecuteReader()
    $cols = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) { $cols += $rd.GetName($i) }
    Write-Output "Columns: $($cols -join ' | ')"
    while ($rd.Read()) {
        $vals = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) {
            $v = $rd.GetValue($i)
            if ($v -is [DBNull]) { $vals += '' } else { $vals += $v.ToString() }
        }
        Write-Output ($vals -join ' | ')
    }
    $rd.Close()

    # RankWork (roles)
    Write-Output ""
    Write-Output "--- Roles (RankWork) ---"
    $cmd2 = $conn.CreateCommand()
    $cmd2.CommandText = "SELECT * FROM RankWork ORDER BY RW_ID"
    $rd2 = $cmd2.ExecuteReader()
    while ($rd2.Read()) {
        $vals = @(); for ($i=0; $i -lt $rd2.FieldCount; $i++) {
            $v = $rd2.GetValue($i)
            if ($v -is [DBNull]) { $vals += '' } else { $vals += $v.ToString() }
        }
        Write-Output ($vals -join ' | ')
    }
    $rd2.Close()

    # RankUser
    Write-Output ""
    Write-Output "--- RankUser ---"
    $cmd3 = $conn.CreateCommand()
    $cmd3.CommandText = "SELECT * FROM RankUser ORDER BY RU_ID"
    $rd3 = $cmd3.ExecuteReader()
    while ($rd3.Read()) {
        $vals = @(); for ($i=0; $i -lt $rd3.FieldCount; $i++) {
            $v = $rd3.GetValue($i)
            if ($v -is [DBNull]) { $vals += '' } else { $vals += $v.ToString() }
        }
        Write-Output ($vals -join ' | ')
    }
    $rd3.Close()

    $conn.Close()
    Write-Output ""
}
