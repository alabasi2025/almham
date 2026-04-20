# Zip the ECAS application folder for download
$src = 'C:\Program Files (x86)\Electricity Customers Accounts System'
$dst = 'C:\Temp\ECAS\ECAS-App.zip'
Remove-Item $dst -Force -EA SilentlyContinue
Compress-Archive -Path $src -DestinationPath $dst -Force
$size = [math]::Round((Get-Item $dst).Length / 1MB, 1)
Write-Output "Zipped: $dst ($size MB)"
