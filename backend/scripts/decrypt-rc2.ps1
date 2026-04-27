$enc14 = [byte[]]@(0xd3,0xb5,0xf8,0x31,0x89,0xc6,0x39,0x8c,0x23,0xed,0xb1,0x45,0x37,0xd0)
$keyStr = "mypassword4lonin"

$md5 = [System.Security.Cryptography.MD5]::Create()
$hash = $md5.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($keyStr))
$key5 = $hash[0..4]

Write-Host "MD5 key (5B): $([BitConverter]::ToString($key5))"

# Try padding encrypted data to 16 bytes with different values
$padValues = @(0x00, 0x01, 0x02, 0x03, 0x04, 0x20)

foreach ($padByte in $padValues) {
    $enc16 = New-Object byte[] 16
    [Array]::Copy($enc14, $enc16, 14)
    $enc16[14] = $padByte
    $enc16[15] = $padByte

    foreach ($mode in @('ECB','CBC')) {
        try {
            $rc2 = New-Object System.Security.Cryptography.RC2CryptoServiceProvider
            $rc2.Mode = $mode
            $rc2.Padding = 'None'
            $rc2.KeySize = 40
            $rc2.EffectiveKeySize = 40
            $rc2.Key = $key5
            if ($mode -eq 'CBC') { $rc2.IV = New-Object byte[] 8 }
            $dec = $rc2.CreateDecryptor()
            $result = $dec.TransformFinalBlock($enc16, 0, 16)
            $txt = [System.Text.Encoding]::ASCII.GetString($result).TrimEnd([char]0)
            $hex = [BitConverter]::ToString($result)
            $printable = $txt -match '^[\x20-\x7E]+$'
            if ($printable -and $txt.Length -gt 2) {
                Write-Host ">>> RC2-$mode pad=0x$($padByte.ToString('X2')): '$txt'"
            }
        } catch {}
    }
    
    # DES too
    foreach ($mode in @('ECB','CBC')) {
        try {
            $des = New-Object System.Security.Cryptography.DESCryptoServiceProvider
            $des.Mode = $mode
            $des.Padding = 'None'
            $des.Key = $hash[0..7]
            if ($mode -eq 'CBC') { $des.IV = New-Object byte[] 8 }
            $dec = $des.CreateDecryptor()
            $result = $dec.TransformFinalBlock($enc16, 0, 16)
            $txt = [System.Text.Encoding]::ASCII.GetString($result).TrimEnd([char]0)
            $printable = $txt -match '^[\x20-\x7E]+$'
            if ($printable -and $txt.Length -gt 2) {
                Write-Host ">>> DES-$mode pad=0x$($padByte.ToString('X2')): '$txt'"
            }
        } catch {}
    }
}

# Try with PKCS7 padding enabled (auto-detect padding)
foreach ($mode in @('ECB','CBC')) {
    foreach ($padCount in @(1,2,3,4,5,6)) {
        $enc16p = New-Object byte[] 16
        [Array]::Copy($enc14, $enc16p, 14)
        $enc16p[14] = $padCount
        $enc16p[15] = $padCount
        if ($padCount -eq 1) { $enc16p[15] = 1 }
        
        try {
            $rc2 = New-Object System.Security.Cryptography.RC2CryptoServiceProvider
            $rc2.Mode = $mode
            $rc2.Padding = 'PKCS7'
            $rc2.KeySize = 40
            $rc2.EffectiveKeySize = 40
            $rc2.Key = $key5
            if ($mode -eq 'CBC') { $rc2.IV = New-Object byte[] 8 }
            $dec = $rc2.CreateDecryptor()
            $result = $dec.TransformFinalBlock($enc16p, 0, 16)
            $txt = [System.Text.Encoding]::ASCII.GetString($result)
            $printable = $txt -match '^[\x20-\x7E]+$'
            if ($printable) {
                Write-Host ">>> RC2-$mode-PKCS7(pad$padCount): '$txt'"
            }
        } catch {}
    }
}

# Also try PWDCOMPARE on sa with the decrypted results
Write-Host "`n--- Testing against sa password ---"
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost\ECASDEV;Integrated Security=true;TrustServerCertificate=true")
$conn.Open()
$cmd = $conn.CreateCommand()

# Try the most obvious passwords one more time
$tryPwds = @('Ecas@123','123','zuc2673','zuakha033','mypassword4lonin','nullandnotempty','admin','sa','password','2014','ecas2014','almham2026')
foreach ($p in $tryPwds) {
    $cmd.CommandText = "SELECT PWDCOMPARE('$p', password_hash) FROM sys.sql_logins WHERE name='sa'"
    $r = $cmd.ExecuteScalar()
    if ($r -eq 1) { Write-Host "MATCH: $p" }
}
$conn.Close()

Write-Host "Done"
