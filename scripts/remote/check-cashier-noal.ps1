$dbs = @("Ecas2664","Ecas2668","Ecas2670","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()

    $noal = ($cn.CreateCommand())
    $noal.CommandText = "SELECT noal FROM DB_And_Sys_Info"
    $noalVal = $noal.ExecuteScalar()

    $cash = $cn.CreateCommand()
    $cash.CommandText = "SELECT COUNT(*) FROM CashierData"
    $cashCount = $cash.ExecuteScalar()

    $cashActive = $cn.CreateCommand()
    $cashActive.CommandText = "SELECT COUNT(*) FROM CashierData WHERE Csh_IsActive=1 OR Csh_IsActive='True'"
    $cashActiveCount = $cashActive.ExecuteScalar()

    # Check columns in CashierData
    $colCmd = $cn.CreateCommand()
    $colCmd.CommandText = "SELECT TOP 1 * FROM CashierData"
    $colRdr = $colCmd.ExecuteReader()
    $cols = @()
    for ($i = 0; $i -lt $colRdr.FieldCount; $i++) { $cols += $colRdr.GetName($i) }
    $colRdr.Close()

    Write-Host ("$db -> noal=$noalVal | CashierData=$cashCount (active=$cashActiveCount)")
    Write-Host ("  Cols: " + ($cols -join ", "))

    $cn.Close()
}
