# Download and register VB6 OCX files
$url = 'http://100.114.106.110:8899/VB6-OCX.zip'
$zip = 'd:\almham\imports\VB6-OCX.zip'
$tmp = 'd:\almham\imports\vb6ocx'

Write-Host "Downloading VB6 OCX files..." -ForegroundColor Cyan
$wc = New-Object System.Net.WebClient
$wc.DownloadFile($url, $zip)
Write-Host "Downloaded!"

Expand-Archive $zip -DestinationPath $tmp -Force
$ocxDir = Get-ChildItem $tmp -Directory | Select-Object -First 1

Write-Host "Copying and registering..." -ForegroundColor Cyan
$files = Get-ChildItem $ocxDir.FullName -Include '*.ocx','*.dll' -Recurse
foreach ($f in $files) {
    $dest = "C:\Windows\SysWOW64\$($f.Name)"
    if (-not (Test-Path $dest)) {
        Copy-Item $f.FullName $dest -Force
        $reg = regsvr32 /s $dest 2>&1
        Write-Host "  Registered: $($f.Name)" -ForegroundColor Green
    } else {
        Write-Host "  Exists: $($f.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Done! Try running ECAS again." -ForegroundColor Green
