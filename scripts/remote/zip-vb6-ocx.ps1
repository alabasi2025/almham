# Zip all OCX/DLL files from SysWOW64 that ECAS needs
$sysDir = 'C:\Windows\SysWOW64'
$ocxFiles = @('MSCOMCTL.OCX','MSHFLXGD.OCX','MSCOMCT2.OCX','MSSTDFMT.DLL','MSFLXGRD.OCX',
              'COMDLG32.OCX','TABCTL32.OCX','RICHTX32.OCX','MSADODC.OCX','MSDATGRD.OCX',
              'MSWINSCK.OCX','MSINET.OCX','MSCAL.OCX','MSDATLST.OCX','MSDATREP.OCX',
              'COMCTL32.OCX','DBLIST32.OCX','DBGRID32.OCX','MSMASK32.OCX','MSCHRT20.OCX',
              'MSRDC20.OCX','MSRDO20.DLL','MSBIND.DLL','MSDATSRC.TLB','MSADO15.DLL',
              'MSJET35.DLL','MSRD3X40.DLL','MSOLEDBSQL.DLL')

$tempDir = 'C:\Temp\ECAS\vb6ocx'
New-Item $tempDir -ItemType Directory -Force | Out-Null

$count = 0
foreach ($f in $ocxFiles) {
    $src = Join-Path $sysDir $f
    if (Test-Path $src) {
        Copy-Item $src $tempDir -Force
        $count++
    }
}

# Also copy any OCX/DLL from ECAS app folder
Get-ChildItem 'C:\Program Files (x86)\Electricity Customers Accounts System' -Include '*.ocx','*.dll' -Recurse -EA SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $tempDir -Force
    $count++
}

Compress-Archive $tempDir -DestinationPath 'C:\Temp\ECAS\VB6-OCX.zip' -Force
$size = [math]::Round((Get-Item 'C:\Temp\ECAS\VB6-OCX.zip').Length/1KB)
Write-Output "Zipped $count files ($size KB)"
