# =========================================================
# Alham MCP Server - Remote command execution via Tailscale
# Run this on the SERVER. It listens on TCP and executes
# PowerShell commands received from Cascade.
# =========================================================
# SECURITY: Token-based auth. Bind to Tailscale IP only.
# Stop anytime with Ctrl+C.
# =========================================================

param(
    [int]$Port = 7777,
    [string]$Secret = 'AlhamCascade@2026',
    [string]$BindIp = '100.114.106.110'   # Tailscale IP of this server
)

$ErrorActionPreference = 'Continue'
$logFile = "$env:USERPROFILE\Desktop\alham-mcp.log"

# Bind to the Tailscale IP (safer than 0.0.0.0)
try {
    $listenAddr = [System.Net.IPAddress]::Parse($BindIp)
    $listener = [System.Net.Sockets.TcpListener]::new($listenAddr, $Port)
    $listener.Start()
} catch {
    Write-Host "Cannot bind to $BindIp. Trying Any..." -ForegroundColor Yellow
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $listener.Start()
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Alham MCP Server - READY" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Listening on : ${BindIp}:${Port}" -ForegroundColor White
Write-Host " Token        : $Secret" -ForegroundColor White
Write-Host " Log file     : $logFile" -ForegroundColor White
Write-Host ""
Write-Host " Send this IP+Port+Token to Cascade" -ForegroundColor Yellow
Write-Host " Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

"Started: $(Get-Date)" | Out-File $logFile -Encoding UTF8

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $remote = $client.Client.RemoteEndPoint.ToString()

        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::UTF8)
        $writer.NewLine = "`n"
        $writer.AutoFlush = $true

        # Read JSON request (one line)
        $jsonLine = $reader.ReadLine()
        if (-not $jsonLine) {
            $client.Close()
            continue
        }

        try {
            $req = $jsonLine | ConvertFrom-Json
        } catch {
            $writer.WriteLine('{"status":-1,"error":"Bad JSON"}')
            $client.Close()
            continue
        }

        # Auth check
        if ($req.token -ne $Secret) {
            Write-Host "[$(Get-Date -Format HH:mm:ss)] REJECTED from $remote (bad token)" -ForegroundColor Red
            $writer.WriteLine('{"status":-1,"error":"Invalid token"}')
            $client.Close()
            continue
        }

        $cmd = $req.command
        $cmdPreview = if ($cmd.Length -gt 80) { $cmd.Substring(0, 80) + '...' } else { $cmd }
        Write-Host "[$(Get-Date -Format HH:mm:ss)] EXEC: $cmdPreview" -ForegroundColor Green
        "[$(Get-Date)] [$remote] $cmd" | Add-Content $logFile -Encoding UTF8

        # Execute
        $output = ''
        $status = 0
        try {
            $output = (Invoke-Expression $cmd 2>&1 | Out-String)
        } catch {
            $output = $_.Exception.Message
            $status = 1
        }

        # Truncate huge outputs to prevent issues
        if ($output.Length -gt 500000) {
            $output = $output.Substring(0, 500000) + "`n... [truncated]"
        }

        $respObj = [PSCustomObject]@{
            status = $status
            output = $output
        }
        $json = $respObj | ConvertTo-Json -Compress -Depth 3

        $writer.WriteLine($json)
        $client.Close()
    } catch {
        Write-Host "Listener error: $($_.Exception.Message)" -ForegroundColor Red
        try { $client.Close() } catch {}
    }
}
