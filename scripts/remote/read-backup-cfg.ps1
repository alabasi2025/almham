foreach ($db in @('Ecas2668','Ecas2672','Ecas2673')) {
    $csv = Import-Csv "D:\almham\imports\ecas-data\$db.CompInfoAndSysOption.csv"
    Write-Host ("$db -> Allow=" + $csv.db_AllawDailyBackUp + " Path=[" + $csv.db_DailyBackUpPath + "] LastBU=[" + $csv.db_DbBULD + "] Hours=" + $csv.db_TimeInHourseToRecreatedbBackup)
}
