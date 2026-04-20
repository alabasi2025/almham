$target = '100.114.106.110'
$ports = @(
    @{p=445;  n='SMB'},
    @{p=3389; n='RDP'},
    @{p=5985; n='WinRM-HTTP'},
    @{p=5986; n='WinRM-HTTPS'},
    @{p=135;  n='RPC'},
    @{p=139;  n='NetBIOS'},
    @{p=80;   n='HTTP'},
    @{p=443;  n='HTTPS'},
    @{p=8080; n='HTTP-Alt'},
    @{p=1433; n='SQL'}
)
foreach ($entry in $ports) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $r = $tcp.BeginConnect($target, $entry.p, $null, $null)
        $ok = $r.AsyncWaitHandle.WaitOne(1000, $false)
        if ($ok -and $tcp.Connected) {
            Write-Host ("OPEN   {0,-5} {1}" -f $entry.p, $entry.n) -ForegroundColor Green
        } else {
            Write-Host ("closed {0,-5} {1}" -f $entry.p, $entry.n) -ForegroundColor DarkGray
        }
    } catch {
        Write-Host ("closed {0,-5} {1}" -f $entry.p, $entry.n) -ForegroundColor DarkGray
    } finally {
        $tcp.Close()
    }
}
