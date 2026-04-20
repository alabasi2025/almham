# Execute SQL query on remote server using .NET SqlClient (Windows Auth, no sqlcmd needed)
# Usage: .\rx-sql.ps1 "SELECT * FROM sys.databases"

param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Query,

    [string]$Database = 'master',
    [string]$Server = '100.114.106.110',
    [int]$Port = 7777,
    [string]$Secret = 'AlhamCascade@2026'
)

$bytes = [System.Text.Encoding]::UTF8.GetBytes($Query)
$b64   = [Convert]::ToBase64String($bytes)

# Build a script that runs on the remote server and returns the results
$remote = @"
`$q = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64'));
`$cs = 'Server=localhost;Database=$Database;Integrated Security=True;Connection Timeout=10;TrustServerCertificate=true';
`$c = New-Object System.Data.SqlClient.SqlConnection(`$cs);
try {
    `$c.Open();
    `$cmd = `$c.CreateCommand();
    `$cmd.CommandText = `$q;
    `$cmd.CommandTimeout = 60;
    `$reader = `$cmd.ExecuteReader();
    `$cols = @();
    for (`$i = 0; `$i -lt `$reader.FieldCount; `$i++) { `$cols += `$reader.GetName(`$i) }
    Write-Output (`$cols -join ' | ');
    Write-Output ('-' * 60);
    while (`$reader.Read()) {
        `$row = @();
        for (`$i = 0; `$i -lt `$reader.FieldCount; `$i++) {
            `$v = `$reader.GetValue(`$i);
            if (`$v -is [DBNull]) { `$row += 'NULL' } else { `$row += `$v.ToString() }
        }
        Write-Output (`$row -join ' | ');
    }
    `$reader.Close();
    `$c.Close();
} catch {
    Write-Output ('SQL ERROR: ' + `$_.Exception.Message);
}
"@

$rx = Join-Path $PSScriptRoot 'rx.ps1'
& $rx -Server $Server -Port $Port -Secret $Secret $remote
