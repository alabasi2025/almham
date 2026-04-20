$dbs = @("Ecas2664","Ecas2668","Ecas2670","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()

    $noalCmd = $cn.CreateCommand()
    $noalCmd.CommandText = "SELECT noal FROM DB_And_Sys_Info"
    $noal = $noalCmd.ExecuteScalar()

    # Count cashiers with device serials registered
    $devCmd = $cn.CreateCommand()
    $devCmd.CommandText = "SELECT COUNT(*) FROM CashierData WHERE Dev_Serl IS NOT NULL AND Dev_Serl <> ''"
    $devCount = $devCmd.ExecuteScalar()

    $newDevCmd = $cn.CreateCommand()
    $newDevCmd.CommandText = "SELECT COUNT(*) FROM CashierData WHERE NewDev_Serl IS NOT NULL AND NewDev_Serl <> ''"
    $newDevCount = $newDevCmd.ExecuteScalar()

    # Count Mobile_Or_Terminal = 0 (terminal), 1 (mobile)
    $termCmd = $cn.CreateCommand()
    $termCmd.CommandText = "SELECT Mobile_Or_Terminal, COUNT(*) AS cnt FROM CashierData GROUP BY Mobile_Or_Terminal ORDER BY Mobile_Or_Terminal"
    $termRdr = $termCmd.ExecuteReader()
    $termCounts = @{}
    while ($termRdr.Read()) { $termCounts[$termRdr[0].ToString()] = $termRdr[1].ToString() }
    $termRdr.Close()

    # Count by RS_ID (branch)
    $brCmd = $cn.CreateCommand()
    $brCmd.CommandText = "SELECT RS_ID, COUNT(*) FROM CashierData GROUP BY RS_ID ORDER BY RS_ID"
    $brRdr = $brCmd.ExecuteReader()
    $brInfo = @()
    while ($brRdr.Read()) { $brInfo += ("RS=" + $brRdr[0].ToString() + ":" + $brRdr[1].ToString()) }
    $brRdr.Close()

    Write-Host ("$db -> noal=$noal | Dev_Serl=$devCount | NewDev_Serl=$newDevCount | TermTypes=" + ($termCounts.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" } | Join-String -Separator ","))
    Write-Host ("  ByCashierBranch: " + ($brInfo -join " | "))
    $cn.Close()
}
