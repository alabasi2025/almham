foreach ($db in @('Ecas2668','Ecas2672','Ecas2673')) {
    $csv = Import-Csv "D:\almham\imports\ecas-data\$db.Branch.csv"
    Write-Host ("=== $db ===")
    foreach ($row in $csv) {
        Write-Host ("  Brn_ID=" + $row.Brn_ID + " Brn_DBName=[" + $row.Brn_DBName + "] Brn_DBPassWord=[" + $row.Brn_DBPassWord + "] Brn_DBVersion=[" + $row.Brn_DBVersion + "]")
    }
}
