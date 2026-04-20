# Restore ECAS databases with TDE certificate to local SQL Express
$server = '.\ECASDEV'
$cs = "Server=$server;Integrated Security=true;TrustServerCertificate=true"
$bakDir = 'd:\almham\imports'
$dataDir = 'd:\almham\imports\sqldata'
$certPass = 'Alham@CertKey2026!'

New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()

# Step 1: Import TDE certificate
Write-Host "=== Importing TDE Certificate ===" -ForegroundColor Cyan
try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "CREATE MASTER KEY ENCRYPTION BY PASSWORD = N'$certPass'"
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "  Master key created" -ForegroundColor Green
} catch { Write-Host "  Master key: $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Yellow }

try {
    $cmd2 = $conn.CreateCommand()
    $cmd2.CommandText = "CREATE CERTIFICATE [Ecas0To9_Clit_Certificate] FROM FILE = N'$bakDir\TDECert.cer' WITH PRIVATE KEY (FILE = N'$bakDir\TDECert.pvk', DECRYPTION BY PASSWORD = N'$certPass')"
    $cmd2.ExecuteNonQuery() | Out-Null
    Write-Host "  Certificate imported!" -ForegroundColor Green
} catch { Write-Host "  Certificate: $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Yellow }

# Step 2: Restore each database
Write-Host ""
Write-Host "=== Restoring Databases ===" -ForegroundColor Cyan
$baks = Get-ChildItem $bakDir -Filter 'Ecas*.bak' | Where-Object { $_.Length -gt 50MB }

foreach ($bak in $baks) {
    $db = $bak.BaseName
    Write-Host "Restoring $db ($([math]::Round($bak.Length/1MB)) MB)..." -ForegroundColor Cyan

    try {
        $cmd3 = $conn.CreateCommand()
        $cmd3.CommandText = "RESTORE FILELISTONLY FROM DISK = N'$($bak.FullName)'"
        $cmd3.CommandTimeout = 300
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd3)
        $dt = New-Object System.Data.DataTable
        $adapter.Fill($dt) | Out-Null

        $dataFile = $dt.Rows[0]['LogicalName']
        $logFile = $dt.Rows[1]['LogicalName']

        $cmd4 = $conn.CreateCommand()
        $cmd4.CommandText = "RESTORE DATABASE [$db] FROM DISK = N'$($bak.FullName)' WITH REPLACE, MOVE N'$dataFile' TO N'$dataDir\${db}.mdf', MOVE N'$logFile' TO N'$dataDir\${db}_log.ldf'"
        $cmd4.CommandTimeout = 600
        $cmd4.ExecuteNonQuery() | Out-Null
        Write-Host "  OK: $db restored!" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message.Split([char]10)[0])" -ForegroundColor Red
    }
}

$conn.Close()

# Step 3: Verify
Write-Host ""
Write-Host "=== Databases ===" -ForegroundColor Cyan
$conn2 = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn2.Open()
$cmd5 = $conn2.CreateCommand()
$cmd5.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4"
$rd = $cmd5.ExecuteReader()
while ($rd.Read()) { Write-Host "  $($rd.GetString(0))" -ForegroundColor Green }
$rd.Close()
$conn2.Close()
