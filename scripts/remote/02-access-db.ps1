# Read the Access .mDb file to find configuration
$app = 'C:\Program Files (x86)\Electricity Customers Accounts System'
$mdb = Get-ChildItem $app -Recurse -File -Filter *.mDb | Select-Object -First 1

if (-not $mdb) {
    Write-Output "No .mDb file found"
    return
}

Write-Output "File: $($mdb.FullName)"
Write-Output "Size: $([math]::Round($mdb.Length/1KB,1)) KB"
Write-Output ""

# Try both Jet and ACE
$providers = @(
    "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$($mdb.FullName);",
    "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$($mdb.FullName);Persist Security Info=False;",
    "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$($mdb.FullName);"
)

$opened = $false
foreach ($cs in $providers) {
    try {
        $c = New-Object System.Data.OleDb.OleDbConnection($cs)
        $c.Open()
        Write-Output "OPENED with: $($cs.Split(';')[0])"
        $opened = $true
        break
    } catch {
        Write-Output ("FAILED: " + $cs.Split(';')[0] + " -> " + $_.Exception.Message.Split("`n")[0])
    }
}

if (-not $opened) {
    Write-Output ""
    Write-Output "Could not open. Raw strings in file:"
    $bytes = [System.IO.File]::ReadAllBytes($mdb.FullName)
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    $text -split "`0" | Where-Object { $_.Length -ge 10 -and $_.Length -le 500 -and $_ -match '(?i)(server|data source|password|catalog|user|connection)' } | Select-Object -First 30 | ForEach-Object { Write-Output $_ }
    return
}

Write-Output ""
Write-Output "=== Tables ==="
$schema = $c.GetSchema("Tables")
$tables = @()
foreach ($row in $schema) {
    if ($row.TABLE_TYPE -eq 'TABLE') {
        $tables += $row.TABLE_NAME
        Write-Output "  $($row.TABLE_NAME)"
    }
}

Write-Output ""
Write-Output "=== Reading each table (first 10 rows) ==="
foreach ($t in $tables) {
    Write-Output ""
    Write-Output "--- Table: $t ---"
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = "SELECT TOP 10 * FROM [$t]"
        $reader = $cmd.ExecuteReader()

        $cols = @()
        for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
        Write-Output ("Columns: " + ($cols -join ' | '))

        $rowCount = 0
        while ($reader.Read() -and $rowCount -lt 10) {
            $vals = @()
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $v = $reader.GetValue($i)
                if ($v -is [DBNull]) { $vals += 'NULL' } else { $vals += $v.ToString() }
            }
            Write-Output ($vals -join ' | ')
            $rowCount++
        }
        $reader.Close()
    } catch {
        Write-Output ("  Error: " + $_.Exception.Message)
    }
}

$c.Close()
