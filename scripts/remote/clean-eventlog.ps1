# Clear Windows Event Logs that ECAS reads
wevtutil cl Application
wevtutil cl System
wevtutil cl Security
Write-Output 'Event logs cleared'

# Restart SQL one final clean time
net stop MSSQLSERVER /y 2>&1 | Out-Null
Start-Sleep 3
net start MSSQLSERVER 2>&1 | Out-Null
Write-Output 'SQL restarted'
