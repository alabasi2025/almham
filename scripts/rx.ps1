# =========================================================
# rx = Remote eXecute
# Sends a command to the Alham MCP server and prints output.
# Usage: .\rx.ps1 "Get-Service MSSQLSERVER"
# =========================================================

param(
    [Parameter(Mandatory, Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$CommandParts,

    [string]$Server = '100.114.106.110',
    [int]$Port = 7777,
    [string]$Secret = 'AlhamCascade@2026',
    [int]$TimeoutSec = 60
)

$Command = $CommandParts -join ' '

$client = [System.Net.Sockets.TcpClient]::new()
$client.ReceiveTimeout = $TimeoutSec * 1000
$client.SendTimeout = 10000
$client.ReceiveBufferSize = 1048576
$client.SendBufferSize = 1048576

try {
    $client.Connect($Server, $Port)
} catch {
    Write-Host "Cannot connect to ${Server}:${Port} : $($_.Exception.Message)" -ForegroundColor Red
    exit 2
}

$stream = $client.GetStream()
$reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
$writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::UTF8)
$writer.NewLine = "`n"
$writer.AutoFlush = $true

$req = [PSCustomObject]@{
    token   = $Secret
    command = $Command
} | ConvertTo-Json -Compress

$writer.WriteLine($req)

$respLine = $reader.ReadLine()
$client.Close()

if (-not $respLine) {
    Write-Host "Empty response from server" -ForegroundColor Red
    exit 3
}

try {
    $resp = $respLine | ConvertFrom-Json
} catch {
    Write-Host "Bad JSON from server: $respLine" -ForegroundColor Red
    exit 4
}

if ($resp.error) {
    Write-Host "SERVER ERROR: $($resp.error)" -ForegroundColor Red
    exit 5
}

if ($resp.output) {
    Write-Host $resp.output
}

exit [int]$resp.status
