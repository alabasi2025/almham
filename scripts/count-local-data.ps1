# Count local data available for analysis
$dirs = Get-ChildItem 'd:\almham\imports\ecas-full' -Directory

foreach ($d in $dirs) {
    $csvs = Get-ChildItem $d.FullName -Filter *.csv
    $totalRows = 0
    foreach ($c in $csvs) {
        $lines = (Get-Content $c.FullName -ReadCount 0).Count - 1
        if ($lines -gt 0) { $totalRows += $lines }
    }
    Write-Host "$($d.Name): $($csvs.Count) tables, $totalRows total rows"
}

Write-Host ""
Write-Host "=== ecas-data (key tables) ==="
$csvs2 = Get-ChildItem 'd:\almham\imports\ecas-data' -Filter *.csv
Write-Host "$($csvs2.Count) CSV files"
