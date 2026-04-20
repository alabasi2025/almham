$ErrorActionPreference = 'Stop'
$dbs = @('Ecas2668','Ecas2672','Ecas2673')
foreach($db in $dbs) {
    Write-Host "--- $db ---"
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection
        $cn.ConnectionString = 'Server=localhost;Database=' + $db + ';Integrated Security=True;Connect Timeout=5;'
        $cn.Open()
        Write-Host "  Connected OK"
        $q1 = $cn.CreateCommand()
        $q1.CommandText = 'SELECT noal FROM DB_And_Sys_Info'
        $noal = $q1.ExecuteScalar()
        Write-Host ("  noal = " + $noal)
        $q2 = $cn.CreateCommand()
        $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
        $cnt = $q2.ExecuteScalar()
        Write-Host ("  Dev_Serl_Count = " + $cnt)
        if ([string]$noal -ne [string]$cnt) {
            Write-Host ("  *** MISMATCH! noal=" + $noal + " vs count=" + $cnt + " ***")
        } else {
            Write-Host "  Match OK"
        }
        $cn.Close()
    } catch {
        Write-Host ("  ERROR: " + $_.Exception.Message)
    }
}
