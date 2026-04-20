# Restore just Ecas2664 to a different directory
$server = '.\ECASDEV'
$cs = "Server=$server;Integrated Security=true;TrustServerCertificate=true"
$bakFile = 'd:\almham\imports\Ecas2664.bak'
$dataDir = 'd:\almham\imports\sqldata2'

New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "RESTORE FILELISTONLY FROM DISK = N'$bakFile'"
$cmd.CommandTimeout = 300
$adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null

$dataFile = $dt.Rows[0]['LogicalName']
$logFile = $dt.Rows[1]['LogicalName']
Write-Host "Logical files: $dataFile, $logFile"

$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "RESTORE DATABASE [Ecas2664] FROM DISK = N'$bakFile' WITH REPLACE, MOVE N'$dataFile' TO N'$dataDir\Ecas2664.mdf', MOVE N'$logFile' TO N'$dataDir\Ecas2664_log.ldf'"
$cmd2.CommandTimeout = 600
$cmd2.ExecuteNonQuery() | Out-Null
Write-Host "Ecas2664 restored!" -ForegroundColor Green

$conn.Close()
