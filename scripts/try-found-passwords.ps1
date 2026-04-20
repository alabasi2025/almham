# Try passwords found in ECAS binary against SQL Server

$server = '100.114.106.110,1433'

$candidates = @(
    @('sa', 'mypassword4lonin'),
    @('sa', 'mypassword4login'),
    @('sa', 'Mypassword4lonin'),
    @('sa', 'MyPassword4lonin'),
    @('sa', 'MYPASSWORD4LONIN'),
    @('admin', 'mypassword4lonin'),
    @('admin', 'mypassword4login')
)

foreach ($c in $candidates) {
    $user = $c[0]
    $pw   = $c[1]
    $cs   = "Server=$server;Database=master;User ID=$user;Password=$pw;Connection Timeout=5;TrustServerCertificate=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $conn.Open()
        Write-Host "SUCCESS: $user / $pw" -ForegroundColor Green

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name"
        $rd = $cmd.ExecuteReader()
        while ($rd.Read()) { Write-Host "  DB: $($rd.GetString(0))" -ForegroundColor Cyan }
        $rd.Close()
        $conn.Close()
        exit 0
    } catch {
        Write-Host "FAIL: $user / $pw" -ForegroundColor DarkGray
    }
}

# Also try the password with nDB_UserPassWord pattern
# The actual password might be stored in Access DB, but these are the binary-embedded candidates
Write-Host ""
Write-Host "Binary passwords did not work directly. Checking Access DB for real credentials..." -ForegroundColor Yellow
Write-Host "User needs to run on server: open ECAS app settings to find actual SQL password"
