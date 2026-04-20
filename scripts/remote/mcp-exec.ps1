param([string]$Command)
$ip = "100.114.106.110"; $port = 7778; $token = "AlhamAdmin2026"
try {
    $tcp = [System.Net.Sockets.TcpClient]::new($ip, $port)
    $s = $tcp.GetStream()
    $w = New-Object System.IO.StreamWriter($s, [Text.Encoding]::UTF8); $w.AutoFlush = $true
    $r = New-Object System.IO.StreamReader($s, [Text.Encoding]::UTF8)
    $req = @{token=$token; command=$Command} | ConvertTo-Json -Compress
    $w.WriteLine($req)
    $resp = $r.ReadLine() | ConvertFrom-Json
    $tcp.Close()
    if ($resp.status -eq 0) { $resp.output } else { "ERROR: " + $resp.error }
} catch { "CONNECT_ERROR: " + $_.Exception.Message }
