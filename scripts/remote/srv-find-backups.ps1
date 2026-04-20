# Search ALL drives for recent .dbf files (ECAS backups)
Write-Host "=== Searching ALL drives for .dbf files (last 30 days) ===" -ForegroundColor Cyan
$drives = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root
foreach ($drive in $drives) {
    Write-Host ("--- Drive: $drive ---")
    Get-ChildItem $drive -Filter "*.dbf" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.LastWriteTime -ge (Get-Date).AddDays(-30) -and $_.Name -like "*ECAS*" -or $_.Name -like "*DailayDB*" -or $_.Name -like "*BackUp*" } |
        ForEach-Object {
            Write-Host ("  " + $_.FullName + " | " + [math]::Round($_.Length/1MB,1) + "MB | " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm"))
        }
}

# Also search specifically for files matching the DB_Name pattern
Write-Host ""
Write-Host "=== All .dbf files on E:\ (any date) ===" -ForegroundColor Yellow
Get-ChildItem "E:\" -Filter "*.dbf" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  " + $_.FullName + " | " + [math]::Round($_.Length/1MB,1) + "MB | " + $_.LastWriteTime)
}

# Check if there's a temp folder or ECAS subfolder
Write-Host ""
Write-Host "=== ECAS-related folders ===" -ForegroundColor Yellow
Get-ChildItem "E:\" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  E:\" + $_.Name + " | " + (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count + " files")
}
