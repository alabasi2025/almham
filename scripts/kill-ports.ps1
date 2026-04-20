param([int[]]$Ports = @(3000, 4200))
foreach ($port in $Ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "Killed PID $procId on port $port"
      } catch {
        Write-Host "Failed to kill PID $procId on port $port : $_"
      }
    }
  } else {
    Write-Host "Port $port is free"
  }
}
Start-Sleep -Seconds 2
Write-Host "Done."
