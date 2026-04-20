$dbs = @("Ecas2664","Ecas2668","Ecas2670","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()

    $noalCmd = $cn.CreateCommand()
    $noalCmd.CommandText = "SELECT noal FROM DB_And_Sys_Info"
    $noal = $noalCmd.ExecuteScalar()

    $ruCmd = $cn.CreateCommand()
    $ruCmd.CommandText = "SELECT COUNT(*) FROM RankUser"
    $ruCount = $ruCmd.ExecuteScalar()

    $ruGT1Cmd = $cn.CreateCommand()
    $ruGT1Cmd.CommandText = "SELECT COUNT(*) FROM RankUser WHERE RU_ID > 1"
    $ruGT1 = $ruGT1Cmd.ExecuteScalar()

    $upCmd = $cn.CreateCommand()
    $upCmd.CommandText = "SELECT COUNT(*) FROM UserPrivileg"
    $upCount = $upCmd.ExecuteScalar()

    $frkCmd = $cn.CreateCommand()
    $frkCmd.CommandText = "SELECT COUNT(*) FROM FormRankUser"
    $frkCount = $frkCmd.ExecuteScalar()

    $udCmd = $cn.CreateCommand()
    $udCmd.CommandText = "SELECT COUNT(*) FROM UserData WHERE Us_ID NOT IN (-1) AND RU_ID NOT IN (203,204,205)"
    $udCount = $udCmd.ExecuteScalar()

    # Sum of SFID and SEID in RankUser
    $sfCmd = $cn.CreateCommand()
    $sfCmd.CommandText = "SELECT SUM(SFID), SUM(SEID) FROM RankUser WHERE RU_ID > 1"
    $sfRdr = $sfCmd.ExecuteReader()
    $sfSum = 0
    $seSum = 0
    if ($sfRdr.Read()) {
        if (-not $sfRdr.IsDBNull(0)) { $sfSum = $sfRdr.GetValue(0) }
        if (-not $sfRdr.IsDBNull(1)) { $seSum = $sfRdr.GetValue(1) }
    }
    $sfRdr.Close()

    Write-Host ("$db -> noal=$noal | RankUser=$ruCount (>1: $ruGT1) | UserPrivileg=$upCount | FormRankUser=$frkCount | UserData(real)=$udCount | SumSFID=$sfSum SumSEID=$seSum")
    $cn.Close()
}
