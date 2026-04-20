$dbs = @('Ecas2668','Ecas2672','Ecas2673')
foreach($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=$db;Integrated Security=True;")
    $cn.Open()
    Write-Host ""
    Write-Host "===== $db =====" -ForegroundColor Cyan

    # Backup settings from CompInfoAndSysOption
    $q = $cn.CreateCommand()
    $q.CommandText = "SELECT db_AllawDailyBackUp, db_DailyBackUpPath, db_DbBULD, db_TimeInHourseToRecreatedbBackup, db_WhenDoDailyBackUpDontRepelceLastOne FROM CompInfoAndSysOption"
    $r = $q.ExecuteReader()
    if ($r.Read()) {
        Write-Host ("  AllowDailyBackup : " + $r["db_AllawDailyBackUp"].ToString())
        Write-Host ("  BackupPath       : " + $r["db_DailyBackUpPath"].ToString())
        Write-Host ("  LastBackupTime   : " + $r["db_DbBULD"].ToString())
        Write-Host ("  RepeatAfterHours : " + $r["db_TimeInHourseToRecreatedbBackup"].ToString())
        Write-Host ("  DontReplace      : " + $r["db_WhenDoDailyBackUpDontRepelceLastOne"].ToString())
        $backupPath = $r["db_DailyBackUpPath"].ToString()
    }
    $r.Close()

    # Check if backup path exists and is writable
    Write-Host ("  Path exists      : " + (Test-Path $backupPath).ToString())
    if (Test-Path $backupPath) {
        $testFile = Join-Path $backupPath "ecas_write_test.tmp"
        try {
            "test" | Out-File $testFile -Encoding UTF8
            Remove-Item $testFile -Force
            Write-Host "  Path writable    : YES" -ForegroundColor Green
        } catch {
            Write-Host ("  Path writable    : NO - " + $_.Exception.Message) -ForegroundColor Red
        }
    } else {
        Write-Host "  Path writable    : N/A (path not found)" -ForegroundColor Red
    }

    # DB_Name (last backup filename)
    $q2 = $cn.CreateCommand()
    $q2.CommandText = "SELECT DB_Name, noal FROM DB_And_Sys_Info"
    $r2 = $q2.ExecuteReader()
    if ($r2.Read()) {
        Write-Host ("  Last Backup File : " + $r2["DB_Name"].ToString())
        Write-Host ("  noal             : " + $r2["noal"].ToString())
    }
    $r2.Close()

    $cn.Close()
}

# List backup files created today
Write-Host ""
Write-Host "===== Backup files on E:\ today =====" -ForegroundColor Yellow
if (Test-Path "E:\") {
    Get-ChildItem "E:\" -Filter "*.dbf" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime.Date -eq (Get-Date).Date } | ForEach-Object {
        Write-Host ("  " + $_.Name + " | " + [math]::Round($_.Length/1MB,1) + " MB | " + $_.LastWriteTime.ToString("HH:mm"))
    }
} else {
    Write-Host "  E:\ drive NOT accessible!"
}
