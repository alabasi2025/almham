# Find where ECAS stores the spy detection flag

Write-Output "=== VB6 App Settings ==="
Get-ChildItem 'HKCU:\SOFTWARE\VB and VBA Program Settings' -Recurse -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        Write-Output "  $($_.Name) = $($_.Value)"
    }
}

Write-Output ""
Write-Output "=== HKLM VB6 Settings ==="
Get-ChildItem 'HKLM:\SOFTWARE\VB and VBA Program Settings' -Recurse -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        Write-Output "  $($_.Name) = $($_.Value)"
    }
}

Write-Output ""
Write-Output "=== Recent files in ECAS folder ==="
Get-ChildItem 'C:\Program Files (x86)\Electricity Customers Accounts System' -Recurse -File | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } | ForEach-Object {
    Write-Output "  $($_.FullName) | $($_.LastWriteTime) | $($_.Length)"
}

Write-Output ""
Write-Output "=== Recent files in AppData ==="
Get-ChildItem "$env:APPDATA" -Recurse -Depth 2 -File -EA SilentlyContinue | Where-Object { $_.Name -match '(?i)(ecas|electric|yemen)' } | ForEach-Object {
    Write-Output "  $($_.FullName)"
}
Get-ChildItem "$env:LOCALAPPDATA" -Recurse -Depth 2 -File -EA SilentlyContinue | Where-Object { $_.Name -match '(?i)(ecas|electric|yemen)' } | ForEach-Object {
    Write-Output "  $($_.FullName)"
}

Write-Output ""
Write-Output "=== Registry search for spy/ecas ==="
Get-ChildItem 'HKCU:\SOFTWARE' -Recurse -Depth 3 -EA SilentlyContinue | Where-Object { $_.Name -match '(?i)(ecas|electric|yemen|spy|تجسس)' } | ForEach-Object {
    Write-Output "  KEY: $($_.Name)"
    Get-ItemProperty $_.PSPath -EA SilentlyContinue | ForEach-Object {
        $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
            Write-Output "    $($_.Name) = $($_.Value)"
        }
    }
}
