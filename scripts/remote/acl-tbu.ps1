# Check ACL and EFS status of tbu
$path = 'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\tbu'

Write-Output "=== File attributes ==="
$fi = Get-Item $path -Force
Write-Output "Attributes: $($fi.Attributes)"
Write-Output "Encrypted: $($fi.Attributes -band [System.IO.FileAttributes]::Encrypted)"

Write-Output ""
Write-Output "=== ACL ==="
cmd /c "icacls `"$path`""

Write-Output ""
Write-Output "=== Is ECAS running? ==="
Get-Process 'Electricity*' -EA SilentlyContinue | Select-Object Name, Id, StartTime

Write-Output ""
Write-Output "=== Alternative Data Streams ==="
cmd /c "dir /R `"$path`""

Write-Output ""
Write-Output "=== Try as SYSTEM: copy file ==="
cmd /c "copy `"$path`" C:\Temp\ECAS\tbu_copy.bin"
if (Test-Path 'C:\Temp\ECAS\tbu_copy.bin') {
    $b = [System.IO.File]::ReadAllBytes('C:\Temp\ECAS\tbu_copy.bin')
    Write-Output "Copy size: $($b.Length)"
    Write-Output "HEX: $((($b | ForEach-Object { '{0:X2}' -f $_ }) -join ' '))"
}
