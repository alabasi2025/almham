$dir = "C:\Program Files (x86)\Electricity Customers Accounts System\CMSG_Rptfldr"
$out = @()

# Read WaBc files as bytes and text
foreach ($f in @("WaBc_22668.jpg","WaBc_22672.jpg","WaBc_22673.jpg")) {
    $path = Join-Path $dir $f
    $out += ("=== $f ===")
    if (Test-Path $path) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $out += ("  Size: " + $bytes.Length + " bytes")
        $out += ("  HEX: " + [System.BitConverter]::ToString($bytes).Replace("-"," "))
        $out += ("  ASCII: " + [System.Text.Encoding]::ASCII.GetString($bytes))
        $out += ("  UTF8: " + [System.Text.Encoding]::UTF8.GetString($bytes))
    } else {
        $out += "  NOT FOUND"
    }
}

# Also read the Ani file (1 byte)
$out += ""
$out += "=== Ani file ==="
$aniPath = Join-Path $dir "Ani"
if (Test-Path $aniPath) {
    $bytes = [System.IO.File]::ReadAllBytes($aniPath)
    $out += ("  Size: " + $bytes.Length + " bytes")
    $out += ("  HEX: " + [System.BitConverter]::ToString($bytes).Replace("-"," "))
}

# Read MyPicture.bmp (modified today!)
$out += ""
$out += "=== MyPicture.bmp (modified today!) ==="
$bmpPath = Join-Path $dir "MyPicture.bmp"
if (Test-Path $bmpPath) {
    $fi = Get-Item $bmpPath
    $out += ("  Size: " + $fi.Length + " bytes | Modified: " + $fi.LastWriteTime)
    $bytes = [System.IO.File]::ReadAllBytes($bmpPath)
    $out += ("  First 50 bytes HEX: " + [System.BitConverter]::ToString($bytes[0..49]).Replace("-"," "))
}

# Also check DataBase.mDb - what tables does it have?
$out += ""
$out += "=== DataBase.mDb info ==="
$mdbPath = Join-Path $dir "DataBase.mDb"
$fi = Get-Item $mdbPath
$out += ("  Size: " + $fi.Length + " bytes | Modified: " + $fi.LastWriteTime)
$bytes = [System.IO.File]::ReadAllBytes($mdbPath)
$out += ("  First 4 bytes (header): " + [System.BitConverter]::ToString($bytes[0..3]).Replace("-"," "))

$out -join "`n" | Out-File "C:\wabc_out.txt" -Encoding UTF8
Write-Host "Done"
