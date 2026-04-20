# Create standard SQL Server .bak backups for ALL ECAS databases
# These contain EVERYTHING: schema + data + indexes + procedures
$cs = "Server=localhost;User ID=cascade;Password=Alham@Cascade2026!;Database=master;TrustServerCertificate=true"
$backupDir = 'C:\Users\Mohammed\Desktop\ECAS-Backups'

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()

$dbs = @('Ecas2664','Ecas2668','Ecas2670','Ecas2672','Ecas2673')

foreach ($db in $dbs) {
    $bakFile = Join-Path $backupDir "$db.bak"
    Write-Host "Backing up $db..." -ForegroundColor Cyan
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "BACKUP DATABASE [$db] TO DISK = N'$bakFile' WITH FORMAT, COMPRESSION, STATS = 10"
    $cmd.CommandTimeout = 600
    try {
        $cmd.ExecuteNonQuery() | Out-Null
        $size = [math]::Round((Get-Item $bakFile).Length / 1MB, 1)
        Write-Host "  OK: $bakFile ($size MB)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$conn.Close()

Write-Host ""
Write-Host "ALL BACKUPS DONE:" -ForegroundColor Green
Get-ChildItem $backupDir -Filter *.bak | ForEach-Object {
    Write-Host "  $($_.Name) - $([math]::Round($_.Length/1MB,1)) MB"
}
Write-Host ""
Write-Host "Location: $backupDir" -ForegroundColor Cyan
Write-Host "Copy these to d:\almham\imports\ on your dev machine" -ForegroundColor Yellow
