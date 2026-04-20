# Simple HTTP file server on server — lets Cascade download .bak files over Tailscale
# Allow port 8899 through firewall first
$Port = 8899

try {
    netsh advfirewall firewall delete rule name='AlhamFileServer' | Out-Null
} catch {}
netsh advfirewall firewall add rule name='AlhamFileServer' dir=in action=allow protocol=TCP localport=$Port | Out-Null

# Open files for serving
$baseDir = 'C:\Temp\ECAS'
$files = Get-ChildItem $baseDir -Filter *.bak

$listener = New-Object System.Net.HttpListener
$prefix = 'http://+:' + $Port + '/'
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Output "Failed to start listener on port $Port: $($_.Exception.Message)"
    Write-Output "Try running as Administrator, or use 'netsh http add urlacl url=http://+:$Port/ user=Everyone'"
    exit 1
}

Write-Output "HTTP File Server ready on port $Port"
Write-Output "Files available:"
foreach ($f in $files) {
    Write-Output "  $($f.Name) ($([math]::Round($f.Length/1MB,1)) MB) -> http://100.114.106.110:$Port/$($f.Name)"
}
Write-Output "Waiting for requests (timeout 10 min, single file per request)..."

$deadline = (Get-Date).AddMinutes(30)
while ((Get-Date) -lt $deadline) {
    $contextTask = $listener.GetContextAsync()
    while (-not $contextTask.IsCompleted -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
    if (-not $contextTask.IsCompleted) { break }

    $context = $contextTask.Result
    $reqPath = $context.Request.Url.LocalPath.TrimStart('/')
    $full = Join-Path $baseDir $reqPath

    if ($reqPath -eq '' -or $reqPath -eq 'list') {
        $body = ($files | ForEach-Object { "$($_.Name) - $([math]::Round($_.Length/1MB,1)) MB" }) -join "`n"
        $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
        $context.Response.OutputStream.Write($buf, 0, $buf.Length)
        $context.Response.Close()
        continue
    }

    if (Test-Path $full -PathType Leaf) {
        $fi = Get-Item $full
        $context.Response.ContentType = 'application/octet-stream'
        $context.Response.ContentLength64 = $fi.Length
        $fs = [System.IO.File]::OpenRead($full)
        $buf = New-Object byte[] 65536
        while (($read = $fs.Read($buf, 0, $buf.Length)) -gt 0) {
            $context.Response.OutputStream.Write($buf, 0, $read)
        }
        $fs.Close()
        $context.Response.Close()
        Write-Output "Sent: $reqPath ($([math]::Round($fi.Length/1MB,1)) MB)"
    } else {
        $context.Response.StatusCode = 404
        $context.Response.Close()
    }
}

$listener.Stop()
Write-Output "Server stopped"
