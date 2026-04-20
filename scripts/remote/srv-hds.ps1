$out = @()
$hds = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\ExeRef\hds.exe"

# Check hds.exe version info
$fi = Get-Item $hds
$ver = $fi.VersionInfo
$out += ("hds.exe: size=" + $fi.Length + " modified=" + $fi.LastWriteTime.ToString("yyyy-MM-dd"))
$out += ("  Product: " + $ver.ProductName)
$out += ("  Version: " + $ver.FileVersion)
$out += ("  Company: " + $ver.CompanyName)
$out += ("  Description: " + $ver.FileDescription)

# Try running hds.exe with no args, with database names, etc.
$out += ""
$out += "=== Running hds.exe with no args ==="
try { $r = & $hds 2>&1; $out += "Output: " + ($r -join " | ") } catch { $out += "Error: " + $_.Exception.Message }

$out += ""
$out += "=== Running hds.exe Ecas2668 ==="
try { $r = & $hds "Ecas2668" 2>&1; $out += "Output: " + ($r -join " | ") } catch { $out += "Error: " + $_.Exception.Message }

$out += ""
$out += "=== Running hds.exe Ecas2672 ==="
try { $r = & $hds "Ecas2672" 2>&1; $out += "Output: " + ($r -join " | ") } catch { $out += "Error: " + $_.Exception.Message }

# Read hds.exe as strings to see what it does
$out += ""
$out += "=== hds.exe readable strings ==="
$bytes = [System.IO.File]::ReadAllBytes($hds)
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$strings = $text -split "[\x00-\x1F\x7F-\xFF]+" | Where-Object { $_.Length -ge 6 -and $_ -match '^[\x20-\x7E]+$' }
$strings | Select-Object -First 60 | ForEach-Object { $out += "  [" + $_ + "]" }

$out -join "`n" | Out-File "C:\hds_out.txt" -Encoding UTF8
Write-Host "Done"
