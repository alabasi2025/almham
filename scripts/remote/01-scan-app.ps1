# This script runs on the REMOTE server. Scans the billing app for credentials.

$app = 'C:\Program Files (x86)\Electricity Customers Accounts System'

Write-Output "=== Files in app folder ==="
Get-ChildItem $app -Recurse -File |
    Select-Object FullName, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}, LastWriteTime |
    Format-Table -AutoSize | Out-String | Write-Output

Write-Output ""
Write-Output "=== Strings in EXE files (connection-related) ==="
Get-ChildItem $app -Recurse -File -Filter *.exe | ForEach-Object {
    $f = $_
    Write-Output ""
    Write-Output ">>> EXE: $($f.FullName)"
    try {
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)

        # ASCII strings
        $asciiBuilder = New-Object System.Text.StringBuilder
        $current = New-Object System.Text.StringBuilder
        foreach ($b in $bytes) {
            if ($b -ge 32 -and $b -lt 127) {
                [void]$current.Append([char]$b)
            } else {
                if ($current.Length -ge 8) { [void]$asciiBuilder.AppendLine($current.ToString()) }
                [void]$current.Clear()
            }
        }
        $asciiText = $asciiBuilder.ToString()

        # Unicode strings
        $uniText = [System.Text.Encoding]::Unicode.GetString($bytes)

        $pattern = '(?i)(Data Source|Server\s*=|Password|Initial Catalog|User ID|UID=|PWD=|Integrated Security|Provider=)'

        Write-Output "-- ASCII matches --"
        $asciiText -split "`n" | Where-Object { $_ -match $pattern } | Select-Object -First 20 | ForEach-Object { Write-Output $_.Trim() }

        Write-Output "-- Unicode matches --"
        $uniText -split "`0" | Where-Object { $_.Length -ge 10 -and $_.Length -le 500 -and $_ -match $pattern } | Select-Object -First 20 | ForEach-Object { Write-Output $_.Trim() }

    } catch {
        Write-Output ("Error: " + $_.Exception.Message)
    }
}

Write-Output ""
Write-Output "=== Reading Access DB (.mDb) ==="
$mdb = Get-ChildItem $app -Recurse -File -Filter *.mDb | Select-Object -First 1
if ($mdb) {
    Write-Output "File: $($mdb.FullName)"
    try {
        # Try to open with OleDB
        $cs = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$($mdb.FullName);"
        $c = New-Object System.Data.OleDb.OleDbConnection($cs)
        $c.Open()
        Write-Output "OK - Access DB opened"
        $schema = $c.GetSchema("Tables")
        Write-Output "-- Tables --"
        foreach ($row in $schema) {
            if ($row.TABLE_TYPE -eq 'TABLE') {
                Write-Output ("  " + $row.TABLE_NAME)
            }
        }
        $c.Close()
    } catch {
        Write-Output ("Jet failed: " + $_.Exception.Message)
        try {
            $cs2 = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$($mdb.FullName);Persist Security Info=False;"
            $c = New-Object System.Data.OleDb.OleDbConnection($cs2)
            $c.Open()
            Write-Output "OK - ACE opened"
            $schema = $c.GetSchema("Tables")
            foreach ($row in $schema) {
                if ($row.TABLE_TYPE -eq 'TABLE') {
                    Write-Output ("  " + $row.TABLE_NAME)
                }
            }
            $c.Close()
        } catch {
            Write-Output ("ACE also failed: " + $_.Exception.Message)
        }
    }
}
