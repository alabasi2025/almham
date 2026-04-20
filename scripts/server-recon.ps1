# ================================================================
# 🔍 Alham — Server Recon Script
# يفحص اللابتوب السيرفر ويجمع معلومات عنه (قراءة فقط - آمن تماماً)
# ================================================================

$OutputFile = "$env:USERPROFILE\Desktop\alham-server-recon.txt"
$report = New-Object System.Collections.Generic.List[string]

function Section($title) {
    $report.Add("")
    $report.Add("=" * 70)
    $report.Add("  $title")
    $report.Add("=" * 70)
}

Section "1. System Info (معلومات النظام)"
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$report.Add("Computer Name : $env:COMPUTERNAME")
$report.Add("OS            : $($os.Caption) $($os.Version)")
$report.Add("Architecture  : $($os.OSArchitecture)")
$report.Add("RAM           : $([math]::Round($cs.TotalPhysicalMemory/1GB, 1)) GB")
$report.Add("User          : $env:USERNAME")
$report.Add("Domain        : $env:USERDOMAIN")

Section "2. Network (الشبكة)"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    ForEach-Object {
        $report.Add("$($_.InterfaceAlias) : $($_.IPAddress)/$($_.PrefixLength)")
    }
try {
    $public = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 5).ip
    $report.Add("Public IP     : $public")
} catch {
    $report.Add("Public IP     : (no internet or blocked)")
}

Section "3. Installed Programs - Billing/Database related (البرامج المثبّتة)"
$keywords = 'bill|invoice|electr|power|sql|mysql|mariadb|postgres|oracle|access|hexcell|meter|kwh|subscriber|utility|energy'
$regPaths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$matched = Get-ItemProperty $regPaths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match $keywords } |
    Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation |
    Sort-Object DisplayName

if ($matched) {
    foreach ($p in $matched) {
        $report.Add("- $($p.DisplayName)  [v$($p.DisplayVersion)]  by $($p.Publisher)")
        if ($p.InstallLocation) { $report.Add("    Location: $($p.InstallLocation)") }
    }
} else {
    $report.Add("(no obvious billing/db programs found by keyword)")
}

Section "3b. All Running Database Services (خدمات قواعد البيانات النشطة)"
$dbServices = Get-Service | Where-Object {
    $_.Status -eq 'Running' -and
    $_.Name -match 'sql|mysql|mariadb|postgres|oracle|mongodb|redis|firebird'
}
if ($dbServices) {
    foreach ($s in $dbServices) {
        $report.Add("- $($s.Name)  : $($s.DisplayName)  [$($s.Status)]")
    }
} else {
    $report.Add("(no running DB services)")
}

Section "4. Listening TCP Ports (المنافذ المفتوحة)"
$dbPorts = @{
    1433  = 'SQL Server'
    1434  = 'SQL Server Browser'
    3306  = 'MySQL/MariaDB'
    5432  = 'PostgreSQL'
    1521  = 'Oracle'
    27017 = 'MongoDB'
    3050  = 'Firebird'
    80    = 'HTTP'
    443   = 'HTTPS'
    8080  = 'HTTP Alt'
    3389  = 'RDP'
}
try {
    $listening = Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $dbPorts.ContainsKey([int]$_.LocalPort) } |
        Sort-Object LocalPort -Unique
    foreach ($c in $listening) {
        $svc = $dbPorts[[int]$c.LocalPort]
        $proc = (Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName
        $report.Add("Port $($c.LocalPort)  ($svc)  by $proc")
    }
} catch {
    $report.Add("(Get-NetTCPConnection failed — try as admin)")
}

Section "5. SQL Server Instances (إذا موجود)"
try {
    $sqlKey = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL' -ErrorAction Stop
    $sqlKey.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        $report.Add("Instance: $($_.Name)  -> $($_.Value)")
    }
} catch {
    $report.Add("(no SQL Server instances found)")
}

Section "6. Scheduled Tasks (مهام مجدولة — فوترة؟)"
$tasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object {
        $_.TaskName -match 'bill|electric|meter|backup|fatora|كهرب|فوتر' -and
        $_.State -ne 'Disabled'
    }
if ($tasks) {
    foreach ($t in $tasks) {
        $report.Add("- $($t.TaskName)  [$($t.State)]  Path: $($t.TaskPath)")
    }
} else {
    $report.Add("(no matching scheduled tasks)")
}

Section "7. Files/Folders hints (مجلدات مشبوهة)"
$rootPaths = @('C:\', 'D:\', 'E:\')
$folderKeywords = 'bill|electric|meter|utility|power|hexcell|acrel|backup|fatora|kahraba'
foreach ($root in $rootPaths) {
    if (Test-Path $root) {
        try {
            $folders = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match $folderKeywords }
            foreach ($f in $folders) {
                $size = (Get-ChildItem $f.FullName -Recurse -File -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
                $sizeMb = if ($size) { [math]::Round($size/1MB, 1) } else { 0 }
                $report.Add("$($f.FullName)  (~$sizeMb MB)")
            }
        } catch {}
    }
}

Section "8. .mdb / .accdb (Microsoft Access files)"
foreach ($root in @('C:\', 'D:\')) {
    if (Test-Path $root) {
        try {
            Get-ChildItem $root -Recurse -Include *.mdb, *.accdb -ErrorAction SilentlyContinue -Force -Depth 5 |
                Select-Object -First 20 |
                ForEach-Object {
                    $sizeMb = [math]::Round($_.Length/1MB, 2)
                    $report.Add("$($_.FullName)  (${sizeMb} MB)")
                }
        } catch {}
    }
}

Section "9. Local Users (المستخدمون المحلّيون)"
try {
    Get-LocalUser -ErrorAction Stop | Where-Object Enabled | ForEach-Object {
        $report.Add("- $($_.Name)")
    }
} catch {
    $report.Add("(cannot enumerate users)")
}

Section "DONE"
$report.Add("Report generated : $(Get-Date)")
$report.Add("Saved to         : $OutputFile")

# Save + display
$report | Out-File -FilePath $OutputFile -Encoding UTF8
$report | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "تمّ! الملف على سطح المكتب: alham-server-recon.txt" -ForegroundColor Green
Write-Host "أرسله لي (انسخ محتواه أو أعطني الملف)" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
