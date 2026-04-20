$dbs = @("Ecas2664","Ecas2668","Ecas2670","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()

    $noalCmd = $cn.CreateCommand()
    $noalCmd.CommandText = "SELECT noal FROM DB_And_Sys_Info"
    $noal = $noalCmd.ExecuteScalar()

    # count Dev_Serl not empty
    $d1 = $cn.CreateCommand()
    $d1.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
    $devCount = $d1.ExecuteScalar()

    # count NewDev_Serl not empty
    $d2 = $cn.CreateCommand()
    $d2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(NewDev_Serl,'') <> ''"
    $newDevCount = $d2.ExecuteScalar()

    # get all Dev_Serl values
    $d3 = $cn.CreateCommand()
    $d3.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'') <> '' OR ISNULL(NewDev_Serl,'') <> '' ORDER BY Cshr_ID"
    $r3 = $d3.ExecuteReader()
    $devList = @()
    while ($r3.Read()) {
        $devList += ("  Cshr=" + $r3["Cshr_ID"].ToString() + " [" + $r3["Cshr_Name"].ToString() + "] Dev=[" + $r3["Dev_Serl"].ToString() + "] NewDev=[" + $r3["NewDev_Serl"].ToString() + "]")
    }
    $r3.Close()

    Write-Host ""
    Write-Host ("$db -> noal=$noal | Dev_Serl_Count=$devCount | NewDev_Serl_Count=$newDevCount") -ForegroundColor Cyan
    if ($devList.Count -gt 0) {
        $devList | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host "  (no registered devices)"
    }
    $cn.Close()
}
