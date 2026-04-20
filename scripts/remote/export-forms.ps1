# Export all form/screen data from ECAS
$cs = "Server=localhost;Database=Ecas2670;User ID=cascade;Password=Alham@Cascade2026!;TrustServerCertificate=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()

# FormData - all screens
Write-Output "=== FormData (Screens) ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM FormData ORDER BY Frm_ID"
$rd = $cmd.ExecuteReader()
$cols = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) { $cols += $rd.GetName($i) }
Write-Output "Columns: $($cols -join ' | ')"
Write-Output ""
while ($rd.Read()) {
    $vals = @(); for ($i=0; $i -lt $rd.FieldCount; $i++) {
        $v = $rd.GetValue($i)
        if ($v -is [DBNull]) { $vals += 'NULL' } else { $vals += $v.ToString() }
    }
    Write-Output ($vals -join ' | ')
}
$rd.Close()

# FormEvent - events/actions per form
Write-Output ""
Write-Output "=== FormEvent (Actions) ==="
$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "SELECT * FROM FormEvent ORDER BY Frm_ID"
$rd2 = $cmd2.ExecuteReader()
$cols2 = @(); for ($i=0; $i -lt $rd2.FieldCount; $i++) { $cols2 += $rd2.GetName($i) }
Write-Output "Columns: $($cols2 -join ' | ')"
Write-Output ""
while ($rd2.Read()) {
    $vals = @(); for ($i=0; $i -lt $rd2.FieldCount; $i++) {
        $v = $rd2.GetValue($i)
        if ($v -is [DBNull]) { $vals += 'NULL' } else { $vals += $v.ToString() }
    }
    Write-Output ($vals -join ' | ')
}
$rd2.Close()

# FormRankUser - permissions per form
Write-Output ""
Write-Output "=== FormRankUser (Permissions) ==="
$cmd3 = $conn.CreateCommand()
$cmd3.CommandText = "SELECT TOP 20 * FROM FormRankUser ORDER BY Frm_ID"
$rd3 = $cmd3.ExecuteReader()
$cols3 = @(); for ($i=0; $i -lt $rd3.FieldCount; $i++) { $cols3 += $rd3.GetName($i) }
Write-Output "Columns: $($cols3 -join ' | ')"
Write-Output ""
while ($rd3.Read()) {
    $vals = @(); for ($i=0; $i -lt $rd3.FieldCount; $i++) {
        $v = $rd3.GetValue($i)
        if ($v -is [DBNull]) { $vals += 'NULL' } else { $vals += $v.ToString() }
    }
    Write-Output ($vals -join ' | ')
}
$rd3.Close()

# UserPrivileg - user privileges
Write-Output ""
Write-Output "=== UserPrivileg ==="
$cmd4 = $conn.CreateCommand()
$cmd4.CommandText = "SELECT TOP 20 * FROM UserPrivileg"
$rd4 = $cmd4.ExecuteReader()
$cols4 = @(); for ($i=0; $i -lt $rd4.FieldCount; $i++) { $cols4 += $rd4.GetName($i) }
Write-Output "Columns: $($cols4 -join ' | ')"
Write-Output ""
while ($rd4.Read()) {
    $vals = @(); for ($i=0; $i -lt $rd4.FieldCount; $i++) {
        $v = $rd4.GetValue($i)
        if ($v -is [DBNull]) { $vals += 'NULL' } else { $vals += $v.ToString() }
    }
    Write-Output ($vals -join ' | ')
}
$rd4.Close()

$conn.Close()
