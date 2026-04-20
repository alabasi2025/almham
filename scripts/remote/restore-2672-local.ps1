$cn = New-Object System.Data.SqlClient.SqlConnection
$cn.ConnectionString = "Server=.\ECASDEV;Database=master;Integrated Security=True;"
$cn.Open()

$bakFile = "D:\almham\imports\Ecas2672.bak"

# Check backup file info
$headerCmd = $cn.CreateCommand()
$headerCmd.CommandText = "RESTORE HEADERONLY FROM DISK = N'$bakFile'"
Write-Host "=== Backup Header ===" -ForegroundColor Cyan
try {
    $rdr = $headerCmd.ExecuteReader()
    while ($rdr.Read()) {
        Write-Host ("  BackupType=" + $rdr["BackupType"].ToString() + " DatabaseName=" + $rdr["DatabaseName"].ToString() + " BackupFinishDate=" + $rdr["BackupFinishDate"].ToString())
    }
    $rdr.Close()
} catch {
    Write-Host ("  Error: " + $_.Exception.Message) -ForegroundColor Red
}

# Check if Ecas2672 already exists
$existCmd = $cn.CreateCommand()
$existCmd.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE name='Ecas2672'"
$exists = $existCmd.ExecuteScalar()

if ($exists -gt 0) {
    Write-Host "Ecas2672 already exists in ECASDEV!" -ForegroundColor Yellow
} else {
    Write-Host "Ecas2672 NOT found - attempting restore..." -ForegroundColor Yellow

    # Get logical file names from backup
    $filesCmd = $cn.CreateCommand()
    $filesCmd.CommandText = "RESTORE FILELISTONLY FROM DISK = N'$bakFile'"
    $filesRdr = $filesCmd.ExecuteReader()
    $logicalNames = @()
    while ($filesRdr.Read()) {
        $logicalNames += @{ Name=$filesRdr["LogicalName"].ToString(); Type=$filesRdr["Type"].ToString() }
    }
    $filesRdr.Close()
    
    Write-Host "  Logical files in backup:"
    $logicalNames | ForEach-Object { Write-Host ("    " + $_.Type + ": " + $_.Name) }

    # Attempt restore
    $dataFile = ($logicalNames | Where-Object { $_.Type -eq "D" } | Select-Object -First 1).Name
    $logFile = ($logicalNames | Where-Object { $_.Type -eq "L" } | Select-Object -First 1).Name

    $restoreSql = @"
RESTORE DATABASE [Ecas2672] 
FROM DISK = N'$bakFile'
WITH MOVE N'$dataFile' TO N'C:\ECASDEV\Ecas2672.mdf',
     MOVE N'$logFile' TO N'C:\ECASDEV\Ecas2672_log.ldf',
     REPLACE, STATS = 10
"@
    $restoreCmd = $cn.CreateCommand()
    $restoreCmd.CommandText = $restoreSql
    $restoreCmd.CommandTimeout = 300
    try {
        $restoreCmd.ExecuteNonQuery()
        Write-Host "Restore completed!" -ForegroundColor Green
    } catch {
        Write-Host ("Restore error: " + $_.Exception.Message) -ForegroundColor Red
    }
}
$cn.Close()
