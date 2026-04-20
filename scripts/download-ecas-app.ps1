# Download ECAS app zip
$url = 'http://100.114.106.110:8899/ECAS-App.zip'
$out = 'd:\almham\imports\ECAS-App.zip'
Write-Host "Downloading ECAS app (54 MB)..."
$wc = New-Object System.Net.WebClient
$wc.DownloadFile($url, $out)
Write-Host "Downloaded!"

# Extract
$dest = 'd:\almham\imports\ECAS-App'
Remove-Item $dest -Recurse -Force -EA SilentlyContinue
Expand-Archive $out -DestinationPath $dest -Force
Write-Host "Extracted to: $dest"
Get-ChildItem $dest -Recurse -Filter '*.exe' | ForEach-Object { Write-Host "  EXE: $($_.FullName)" }
