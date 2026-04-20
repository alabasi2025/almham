$out = @()
$ecasDir = "C:\Program Files (x86)\Electricity Customers Accounts System"

# List ALL files in ECAS dir (top level)
$out += "=== All files in ECAS main dir ==="
Get-ChildItem $ecasDir -File -ErrorAction SilentlyContinue | ForEach-Object {
    $out += ("  " + $_.Name + " | " + $_.Length + " bytes | " + $_.LastWriteTime.ToString("yyyy-MM-dd"))
}

# List all .mdb / .accdb / .mdw files
$out += ""
$out += "=== MDB/ACCDB/MDW files ==="
Get-ChildItem $ecasDir -Recurse -Include "*.mdb","*.accdb","*.mdw","*.lnk","*.bat","*.cmd" -ErrorAction SilentlyContinue | ForEach-Object {
    $out += ("  " + $_.FullName + " | " + $_.Length + " bytes | " + $_.LastWriteTime.ToString("yyyy-MM-dd"))
}

# Search all desktops for ECAS shortcuts
$out += ""
$out += "=== Shortcuts on all desktops ==="
$shell = New-Object -ComObject WScript.Shell
$desktops = @("C:\Users\Public\Desktop") + (Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "Desktop" })
foreach ($d in $desktops) {
    if (Test-Path $d) {
        Get-ChildItem $d -Filter "*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*ECAS*" -or $_.Name -like "*Electric*" -or $_.Name -like "*268*" -or $_.Name -like "*272*" -or $_.Name -like "*273*" -or $_.Name -like "*مرانى*" -or $_.Name -like "*غليل*" -or $_.Name -like "*دهمية*" } | ForEach-Object {
            try {
                $lnk = $shell.CreateShortcut($_.FullName)
                $out += ("  " + $_.Name)
                $out += ("    Target: " + $lnk.TargetPath)
                $out += ("    Args:   " + $lnk.Arguments)
                $out += ("    Start:  " + $lnk.WorkingDirectory)
            } catch { $out += ("  ERROR: " + $_.Exception.Message) }
        }
    }
}

# Check if ECAS uses ini files in Ref folders
$out += ""
$out += "=== Files in each Ref folder ==="
foreach ($ref in @("2668_Mrany_NewSabalieah","2672_Mrany_Gholeeil","2673_Mrany_Dohmyah")) {
    $refPath = Join-Path $ecasDir ("ECAS_" + $ref + "_Ref")
    $out += ("  --- $ref ---")
    Get-ChildItem $refPath -File -ErrorAction SilentlyContinue | ForEach-Object {
        $out += ("    " + $_.Name + " | " + $_.Length)
    }
    # Also check if there's an mdb/ini inside ExeRef
    Get-ChildItem (Join-Path $refPath "ExeRef") -File -ErrorAction SilentlyContinue | ForEach-Object {
        $out += ("    ExeRef\" + $_.Name + " | " + $_.Length)
    }
}

$out -join "`n" | Out-File "C:\ecas_launch_out.txt" -Encoding UTF8
Write-Host "Done"
