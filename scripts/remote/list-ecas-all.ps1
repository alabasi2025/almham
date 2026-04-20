# List ALL files in ECAS folder and subfolders
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'
Write-Output "=== Complete listing of ECAS folder ==="
Get-ChildItem $base -Recurse -Force -EA SilentlyContinue | Select-Object @{N='Type';E={if($_.PSIsContainer){'D'}else{'F'}}}, LastWriteTime, Length, FullName | ForEach-Object {
    Write-Output ("{0} {1} {2,12} {3}" -f $_.Type, $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'), $_.Length, $_.FullName.Replace($base, ''))
}
