$tmp = $env:TEMP
$out = @()

# Find the temp file hds.exe created
$hdsFile = Get-ChildItem $tmp -Filter "~DF*.TMP" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5
$hdsFile | ForEach-Object {
    $out += ("=== " + $_.Name + " (size=" + $_.Length + " bytes) ===")
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $out += ("HEX: " + [System.BitConverter]::ToString($bytes[0..[Math]::Min(100,$bytes.Length-1)]).Replace("-"," "))
    $out += ("ASCII: [" + [System.Text.Encoding]::ASCII.GetString($bytes) + "]")
    $out += ("UTF8: [" + [System.Text.Encoding]::UTF8.GetString($bytes) + "]")
    $out += ("UTF16: [" + [System.Text.Encoding]::Unicode.GetString($bytes) + "]")
}

# Also check all recent temp files
$out += ""
$out += "=== All recent temp files ==="
Get-ChildItem $tmp -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-2) } | Sort-Object LastWriteTime -Descending | Select-Object -First 20 | ForEach-Object {
    $out += ("  " + $_.Name + " | " + $_.Length + " bytes | " + $_.LastWriteTime.ToString("HH:mm:ss"))
}

# Run hds.exe again via scheduled task (as different user) and capture any registry changes
$out += ""
$out += "=== YemenSoft registry ==="
foreach ($rp in @("HKLM:\SOFTWARE\YemenSoft","HKLM:\SOFTWARE\WOW6432Node\YemenSoft","HKCU:\SOFTWARE\YemenSoft")) {
    if (Test-Path $rp) {
        $out += ("  Found: " + $rp)
        Get-ChildItem $rp -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $out += ("    " + $_.Name) }
    }
}

$out -join "`n" | Out-File "C:\hdsfile_out.txt" -Encoding UTF8
Write-Host "Done"
