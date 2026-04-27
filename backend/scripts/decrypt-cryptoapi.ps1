$enc = [byte[]]@(0xd3,0xb5,0xf8,0x31,0x89,0xc6,0x39,0x8c,0x23,0xed,0xb1,0x45,0x37,0xd0)
$keyStr = "mypassword4lonin"

$md5 = [System.Security.Cryptography.MD5]::Create()
$hash = $md5.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($keyStr))
Write-Host "MD5($keyStr):" ([BitConverter]::ToString($hash))

# Pad encrypted data to 16 bytes for block ciphers
$padded = New-Object byte[] 16
[Array]::Copy($enc, $padded, 14)

# Try RC2 (Microsoft Base Provider default block cipher)
foreach ($mode in @('ECB','CBC')) {
    foreach ($ks in @(40, 64, 128)) {
        try {
            $rc2 = New-Object System.Security.Cryptography.RC2CryptoServiceProvider
            $rc2.Mode = $mode
            $rc2.Padding = 'None'
            $rc2.KeySize = $ks
            $rc2.EffectiveKeySize = $ks
            $keyLen = $ks / 8
            $rc2.Key = $hash[0..($keyLen-1)]
            if ($mode -eq 'CBC') { $rc2.IV = New-Object byte[] 8 }
            $dec = $rc2.CreateDecryptor()
            $result = $dec.TransformFinalBlock($padded, 0, 16)
            $txt = [System.Text.Encoding]::ASCII.GetString($result)
            $hex = [BitConverter]::ToString($result)
            $printable = $txt -match '^[\x20-\x7E]+$'
            if ($printable) {
                Write-Host ">>> RC2-$mode-$ks :" $txt
            }
            Write-Host "RC2-$mode-$ks :" $hex
        } catch {
            Write-Host "RC2-$mode-$ks err:" $_.Exception.InnerException.Message
        }
    }
}

# Try DES
foreach ($mode in @('ECB','CBC')) {
    try {
        $des = New-Object System.Security.Cryptography.DESCryptoServiceProvider
        $des.Mode = $mode
        $des.Padding = 'None'
        $des.Key = $hash[0..7]
        if ($mode -eq 'CBC') { $des.IV = New-Object byte[] 8 }
        $dec = $des.CreateDecryptor()
        $result = $dec.TransformFinalBlock($padded, 0, 16)
        $txt = [System.Text.Encoding]::ASCII.GetString($result)
        $hex = [BitConverter]::ToString($result)
        $printable = $txt -match '^[\x20-\x7E]+$'
        if ($printable) { Write-Host ">>> DES-$mode :" $txt }
        Write-Host "DES-$mode :" $hex
    } catch {
        Write-Host "DES-$mode err:" $_.Exception.InnerException.Message
    }
}

# Try TripleDES
foreach ($mode in @('ECB','CBC')) {
    try {
        $tdes = New-Object System.Security.Cryptography.TripleDESCryptoServiceProvider
        $tdes.Mode = $mode
        $tdes.Padding = 'None'
        $key24 = New-Object byte[] 24
        [Array]::Copy($hash, $key24, 16)
        [Array]::Copy($hash, 0, $key24, 16, 8)
        $tdes.Key = $key24
        if ($mode -eq 'CBC') { $tdes.IV = New-Object byte[] 8 }
        $dec = $tdes.CreateDecryptor()
        $result = $dec.TransformFinalBlock($padded, 0, 16)
        $txt = [System.Text.Encoding]::ASCII.GetString($result)
        $printable = $txt -match '^[\x20-\x7E]+$'
        if ($printable) { Write-Host ">>> 3DES-$mode :" $txt }
        Write-Host "3DES-$mode :" ([BitConverter]::ToString($result))
    } catch {
        Write-Host "3DES-$mode err:" $_.Exception.InnerException.Message
    }
}

# Try AES
foreach ($mode in @('ECB','CBC')) {
    try {
        $aes = [System.Security.Cryptography.Aes]::Create()
        $aes.Mode = $mode
        $aes.Padding = 'None'
        $aes.Key = $hash  # 16 bytes = AES-128
        if ($mode -eq 'CBC') { $aes.IV = New-Object byte[] 16 }
        $dec = $aes.CreateDecryptor()
        $result = $dec.TransformFinalBlock($padded, 0, 16)
        $txt = [System.Text.Encoding]::ASCII.GetString($result)
        $printable = $txt -match '^[\x20-\x7E]+$'
        if ($printable) { Write-Host ">>> AES-$mode :" $txt }
        Write-Host "AES-$mode :" ([BitConverter]::ToString($result))
    } catch {
        Write-Host "AES-$mode err:" $_.Exception.InnerException.Message
    }
}

# Also try with UTF-16LE hash
$hashU = $md5.ComputeHash([System.Text.Encoding]::Unicode.GetBytes($keyStr))
Write-Host "`nMD5-UTF16($keyStr):" ([BitConverter]::ToString($hashU))
try {
    $rc2u = New-Object System.Security.Cryptography.RC2CryptoServiceProvider
    $rc2u.Mode = 'ECB'
    $rc2u.Padding = 'None'
    $rc2u.KeySize = 40
    $rc2u.EffectiveKeySize = 40
    $rc2u.Key = $hashU[0..4]
    $dec = $rc2u.CreateDecryptor()
    $result = $dec.TransformFinalBlock($padded, 0, 16)
    Write-Host "RC2-ECB-40-UTF16:" ([BitConverter]::ToString($result)) ([System.Text.Encoding]::ASCII.GetString($result))
} catch { Write-Host "RC2 UTF16 err:" $_.Exception.InnerException.Message }

Write-Host "`nDone!"
