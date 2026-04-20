# Deploy file server on remote machine (write script then start as background process)

$serverScript = @'
$Port = 8899
try { netsh advfirewall firewall delete rule name='AlhamFileServer' | Out-Null } catch {}
netsh advfirewall firewall add rule name='AlhamFileServer' dir=in action=allow protocol=TCP localport=8899 | Out-Null

$baseDir = 'C:\Temp\ECAS'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://+:8899/')
$listener.Start()

"$(Get-Date) Server listening on :8899" | Out-File 'C:\Temp\ECAS\server.log' -Append

while ($true) {
    try {
        $context = $listener.GetContext()
        $reqPath = $context.Request.Url.LocalPath.TrimStart('/')
        "$(Get-Date) Request: $reqPath" | Out-File 'C:\Temp\ECAS\server.log' -Append

        if ($reqPath -eq '' -or $reqPath -eq 'list') {
            $files = Get-ChildItem $baseDir -Filter *.bak
            $body = ($files | ForEach-Object { "$($_.Name) - $([math]::Round($_.Length/1MB,1)) MB" }) -join "`n"
            $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
            $context.Response.OutputStream.Write($buf, 0, $buf.Length)
            $context.Response.Close()
            continue
        }
        $full = Join-Path $baseDir $reqPath
        if (Test-Path $full -PathType Leaf) {
            $fi = Get-Item $full
            $context.Response.ContentType = 'application/octet-stream'
            $context.Response.ContentLength64 = $fi.Length
            $fs = [System.IO.File]::OpenRead($full)
            $buf = New-Object byte[] 1048576
            while (($read = $fs.Read($buf, 0, $buf.Length)) -gt 0) {
                $context.Response.OutputStream.Write($buf, 0, $read)
            }
            $fs.Close()
            $context.Response.Close()
            "$(Get-Date) Sent $reqPath OK" | Out-File 'C:\Temp\ECAS\server.log' -Append
        } else {
            $context.Response.StatusCode = 404
            $context.Response.Close()
        }
    } catch {
        "$(Get-Date) ERROR: $_" | Out-File 'C:\Temp\ECAS\server.log' -Append
    }
}
'@

# Write server script to disk
$scriptPath = 'C:\Temp\ECAS\fileserver.ps1'
Set-Content -Path $scriptPath -Value $serverScript -Encoding UTF8

# Kill any previous instance
Get-Process powershell -EA SilentlyContinue | Where-Object {
    $_.CommandLine -like '*fileserver.ps1*' -or $_.MainWindowTitle -eq 'AlhamFileServer'
} | Stop-Process -Force -EA SilentlyContinue

# Start as detached process
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'powershell.exe'
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$psi.UseShellExecute = $true
$psi.WindowStyle = 'Hidden'
$p = [System.Diagnostics.Process]::Start($psi)

Start-Sleep 2

Write-Output "File server started (PID: $($p.Id))"
Write-Output "Download from: http://100.114.106.110:8899/<filename>"
Write-Output ""
Write-Output "Test - server log:"
Start-Sleep 1
if (Test-Path 'C:\Temp\ECAS\server.log') {
    Get-Content 'C:\Temp\ECAS\server.log' -Tail 5
}
