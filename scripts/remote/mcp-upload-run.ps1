param([string]$LocalFile, [string]$RemotePath = "C:\a.ps1")

$ip = "100.114.106.110"
$port = 7778
$token = "AlhamAdmin2026"

function Send-McpCommand {
    param([string]$Cmd)
    $tcp = [System.Net.Sockets.TcpClient]::new($ip, $port)
    $s = $tcp.GetStream()
    $w = New-Object System.IO.StreamWriter($s, [Text.Encoding]::UTF8); $w.AutoFlush = $true
    $r = New-Object System.IO.StreamReader($s, [Text.Encoding]::UTF8)
    $req = [ordered]@{token=$token; command=$Cmd} | ConvertTo-Json -Compress
    $w.WriteLine($req)
    $resp = $r.ReadLine()
    $tcp.Close()
    if ($resp) { ($resp | ConvertFrom-Json).output } else { "NO_RESPONSE" }
}

# Step 1: Upload file as base64
Write-Host "Uploading $LocalFile -> $RemotePath ..." -ForegroundColor Cyan
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText($LocalFile)))
$uploadCmd = "[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64')) | Out-File '$RemotePath' -Encoding UTF8; 'Upload OK'"
$result = Send-McpCommand $uploadCmd
Write-Host "Upload result: $result" -ForegroundColor Green

# Step 2: Execute the file
Write-Host ""
Write-Host "Executing $RemotePath on server..." -ForegroundColor Cyan
$output = Send-McpCommand "powershell -ExecutionPolicy Bypass -File '$RemotePath'"
Write-Host $output
