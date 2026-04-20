# Export TDE certificate from SQL Server for backup restore on another machine
$cs = "Server=localhost;Integrated Security=true;TrustServerCertificate=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
BACKUP CERTIFICATE [TDECert] TO FILE = 'C:\Temp\ECAS\TDECert.cer'
WITH PRIVATE KEY (
    FILE = 'C:\Temp\ECAS\TDECert.pvk',
    ENCRYPTION BY PASSWORD = 'Alham@CertKey2026!'
)
"@
$cmd.CommandTimeout = 30
try {
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Output "Certificate exported OK"
} catch {
    # Maybe different cert name - find it
    Write-Output "Error: $($_.Exception.Message)"
    Write-Output ""
    Write-Output "Looking for certificates..."
    $cmd2 = $conn.CreateCommand()
    $cmd2.CommandText = "SELECT name, thumbprint, pvt_key_encryption_type_desc FROM master.sys.certificates"
    $rd = $cmd2.ExecuteReader()
    while ($rd.Read()) {
        Write-Output "  $($rd.GetValue(0)) | $($rd.GetValue(1)) | $($rd.GetValue(2))"
    }
    $rd.Close()
}
$conn.Close()
