# Find ALL COM/DLL dependencies of ECAS
# 1. Find the YemenID DLL
$clsid = '{EA47E034-BC56-45EC-BF5F-EA56B24B2F60}'
$inproc = Get-ItemProperty "HKLM:\SOFTWARE\Classes\CLSID\$clsid\InprocServer32" -EA SilentlyContinue
$inproc32 = Get-ItemProperty "HKLM:\SOFTWARE\Classes\WOW6432Node\CLSID\$clsid\InprocServer32" -EA SilentlyContinue
$inprocW = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\$clsid\InprocServer32" -EA SilentlyContinue

Write-Output "=== YemenID COM ==="
if ($inproc) { Write-Output "64bit: $($inproc.'(default)')" }
if ($inproc32) { Write-Output "WOW64: $($inproc32.'(default)')" }
if ($inprocW) { Write-Output "WOW64-2: $($inprocW.'(default)')" }

# 2. Check MSOLEDBSQL provider
Write-Output ""
Write-Output "=== OLEDB Providers ==="
Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\*\ProgID' -EA SilentlyContinue | Where-Object { $_.'(default)' -match 'MSOLEDBSQL|SQLOLEDB|Jet' } | ForEach-Object { Write-Output $_.PSParentPath.Split('\')[-2] + ' = ' + $_.'(default)' } | Select-Object -First 10

# 3. Check Crystal Reports
Write-Output ""
Write-Output "=== Crystal Reports ==="
$cr = Get-ChildItem 'C:\Program Files (x86)' -Filter 'craxdrt.dll' -Recurse -Depth 3 -EA SilentlyContinue
if ($cr) { Write-Output "Found: $($cr.FullName)" }
else { Write-Output "Not in Program Files" }
$cr2 = Get-ChildItem 'C:\Windows\SysWOW64' -Filter 'craxdrt*' -EA SilentlyContinue
if ($cr2) { $cr2 | ForEach-Object { Write-Output "SysWOW64: $($_.Name)" } }
