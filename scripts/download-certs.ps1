# Download TDE certificate files from server
$base = 'http://100.114.106.110:8899'
$out = 'd:\almham\imports'

foreach ($f in @('TDECert.cer','TDECert.pvk','DMK.bak','SMK.bak')) {
    Write-Host "Downloading $f..."
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile("$base/$f", "$out\$f")
    Write-Host "  OK: $((Get-Item "$out\$f").Length) bytes"
}
Write-Host "All certs downloaded!"
