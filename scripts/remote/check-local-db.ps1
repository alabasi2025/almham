$instances = @(".\ECASDEV", ".\SQLEXPRESS", "localhost\ECASDEV", "localhost\SQLEXPRESS")

foreach ($inst in $instances) {
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection
        $cn.ConnectionString = "Server=$inst;Integrated Security=True;Connect Timeout=3;"
        $cn.Open()
        Write-Host "Connected to: $inst" -ForegroundColor Green
        
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE name LIKE 'Ecas%' ORDER BY name"
        $rdr = $cmd.ExecuteReader()
        while ($rdr.Read()) {
            Write-Host ("  DB: " + $rdr[0].ToString())
        }
        $rdr.Close()
        $cn.Close()
    } catch {
        Write-Host ("Cannot connect to " + $inst + ": " + $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length)))
    }
}
