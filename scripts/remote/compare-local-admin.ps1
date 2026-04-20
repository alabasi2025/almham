$dbs = @("Ecas2668","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()
    
    Write-Host ""
    Write-Host "========== $db ==========" -ForegroundColor Cyan
    
    # UserData for administrator
    $cmd = $cn.CreateCommand()
    $cmd.CommandText = "SELECT Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM UserData WHERE Us_ID <= 0 OR Us_ID = 1 ORDER BY Us_ID"
    $rdr = $cmd.ExecuteReader()
    Write-Host "--- UserData (Admin) ---"
    while ($rdr.Read()) {
        Write-Host ("  Us_ID=" + $rdr["Us_ID"].ToString() + " Name=" + $rdr["Us_Name"].ToString() + " PassWord=[" + $rdr["Us_PassWord"].ToString() + "] Updated=" + $rdr["Us_UpDateDate"].ToString())
    }
    $rdr.Close()
    
    # DB_And_Sys_Info
    $cmd2 = $cn.CreateCommand()
    $cmd2.CommandText = "SELECT * FROM DB_And_Sys_Info"
    $rdr2 = $cmd2.ExecuteReader()
    Write-Host "--- DB_And_Sys_Info ---"
    if ($rdr2.Read()) {
        for ($i = 0; $i -lt $rdr2.FieldCount; $i++) {
            Write-Host ("  [" + $rdr2.GetName($i) + "] = [" + $rdr2.GetValue($i).ToString() + "]")
        }
    }
    $rdr2.Close()
    
    $cn.Close()
}
