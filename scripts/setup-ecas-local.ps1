# Setup ODBC DSN for local ECAS
# The ECAS app uses 32-bit ODBC DSN named "Ecas"

# Create 32-bit System DSN
$regPath = 'HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI'
New-Item -Path "$regPath\Ecas" -Force | Out-Null
Set-ItemProperty "$regPath\Ecas" -Name 'Driver' -Value 'C:\Windows\SysWOW64\SQLSRV32.dll'
Set-ItemProperty "$regPath\Ecas" -Name 'Server' -Value '.\ECASDEV'
Set-ItemProperty "$regPath\Ecas" -Name 'LastUser' -Value ''

# Register in ODBC Data Sources
$dsPath = "$regPath\ODBC Data Sources"
if (-not (Test-Path $dsPath)) { New-Item $dsPath -Force | Out-Null }
Set-ItemProperty $dsPath -Name 'Ecas' -Value 'SQL Server'

Write-Host "ODBC DSN 'Ecas' created -> .\ECASDEV" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "  d:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe"
