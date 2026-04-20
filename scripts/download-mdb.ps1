$wc = New-Object System.Net.WebClient
$wc.DownloadFile('http://100.114.106.110:8899/DataBase.mDb', 'C:\Program Files (x86)\Electricity Customers Accounts System\CMSG_Rptfldr\DataBase.mDb')
Write-Host "DataBase.mDb downloaded!"

# Now try running ECAS
Start-Process "C:\Program Files (x86)\Electricity Customers Accounts System\Electricity Customers Accounts System.exe" -WorkingDirectory "C:\Program Files (x86)\Electricity Customers Accounts System"
Write-Host "ECAS launched!"
