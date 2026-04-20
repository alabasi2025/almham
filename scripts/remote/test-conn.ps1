$dbs = @("Ecas2668","Ecas2672","Ecas2673")
foreach ($db in $dbs) {
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection
        $cn.ConnectionString = "Server=100.114.106.110,1433;Database=$db;User Id=cascade;Password=Alham@Cascade2026!;"
        $cn.Open()
        Write-Host "OK: $db"
        $cn.Close()
    } catch {
        Write-Host ("FAIL $db : " + $_.Exception.Message)
    }
}
