$out = @()
$ecasDir = "C:\Program Files (x86)\Electricity Customers Accounts System"

# Check tbu folders with hidden files
$out += "=== tbu folders (including hidden) ==="
foreach ($ref in @("2668_Mrany_NewSabalieah","2672_Mrany_Gholeeil","2673_Mrany_Dohmyah")) {
    $tbu = Join-Path $ecasDir ("ECAS_" + $ref + "_Ref\tbu")
    $out += ("  --- " + $ref + " ---")
    if (Test-Path $tbu) {
        $items = Get-ChildItem $tbu -Force -Recurse -ErrorAction SilentlyContinue
        if ($items.Count -eq 0) {
            $out += "    (empty)"
        } else {
            $items | ForEach-Object {
                $out += ("    " + $_.Name + " | " + $_.Length + " bytes | hidden=" + $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden))
            }
        }
    } else {
        $out += "    tbu folder NOT FOUND"
    }
}

# Check the ECAS main exe version info
$out += ""
$out += "=== ECAS EXE version info ==="
$exe = Join-Path $ecasDir "Electricity Customers Accounts System.exe"
$ver = (Get-Item $exe).VersionInfo
$out += ("  FileVersion: " + $ver.FileVersion)
$out += ("  ProductVersion: " + $ver.ProductVersion)
$out += ("  CompanyName: " + $ver.CompanyName)
$out += ("  Description: " + $ver.FileDescription)
$out += ("  Modified: " + (Get-Item $exe).LastWriteTime.ToString("yyyy-MM-dd HH:mm"))

# Check the CMSG_Rptfldr folder
$out += ""
$out += "=== CMSG_Rptfldr contents ==="
Get-ChildItem (Join-Path $ecasDir "CMSG_Rptfldr") -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $out += ("  " + $_.Name + " | " + $_.Length + " | " + $_.LastWriteTime.ToString("yyyy-MM-dd"))
}

# Check the temp HTML files sizes
$out += ""
$out += "=== Temp HTML files ==="
foreach ($f in @("temp22668.html","temp22672.html","temp22673.html")) {
    $fp = Join-Path $ecasDir $f
    if (Test-Path $fp) {
        $fi = Get-Item $fp
        # Read first 300 chars to see what's inside
        $content = (Get-Content $fp -Encoding UTF8 -ErrorAction SilentlyContinue) -join " "
        $preview = $content.Substring(0, [Math]::Min(300, $content.Length))
        $out += ("  " + $f + " | " + $fi.Length + " bytes | " + $fi.LastWriteTime)
        $out += ("    Preview: " + $preview)
    }
}

$out -join "`n" | Out-File "C:\tbu_trace_out.txt" -Encoding UTF8
Write-Host "Done"
