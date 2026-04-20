#requires -RunAsAdministrator
<#
.SYNOPSIS
    Alham — فتح نفق SSH آمن للسماح لـ Cascade بالاتصال بالسيرفر

.DESCRIPTION
    1. يُثبّت OpenSSH Server (إذا غير مُثبّت)
    2. يُشغّل خدمة SSH
    3. يفتح Firewall للمنفذ 22
    4. يُنشئ مستخدم 'cascade' بكلمة مرور عشوائية قوية
    5. يبدأ نفقاً TCP عبر pinggy.io (مجاني، بدون حساب)

.NOTES
    بعد الانتهاء: احذف المستخدم cascade يدوياً بـ:
        Remove-LocalUser -Name cascade
#>

$ErrorActionPreference = 'Stop'

# ═══════════════════════════════════════════════════════════════
# التحقق من صلاحيات المدير
# ═══════════════════════════════════════════════════════════════
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "❌ هذا السكربت يحتاج صلاحيات مدير" -ForegroundColor Red
    Write-Host "   افتح PowerShell كـ Administrator ثم شغّله" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🔐 Alham Tunnel Setup — فتح نفق آمن لـ Cascade          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# [1/6] تثبيت OpenSSH Server
# ═══════════════════════════════════════════════════════════════
Write-Host "🔧 [1/6] تثبيت OpenSSH Server..." -ForegroundColor Cyan
$sshServer = Get-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 -ErrorAction SilentlyContinue
if ($sshServer -and $sshServer.State -eq 'Installed') {
    Write-Host "   ✅ OpenSSH Server موجود مسبقاً" -ForegroundColor Green
} else {
    try {
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
        Write-Host "   ✅ تم التثبيت" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️ فشل التثبيت: $_" -ForegroundColor Yellow
        Write-Host "   تجربة طريقة بديلة..." -ForegroundColor Yellow
        Start-Process "dism.exe" -ArgumentList "/Online", "/Add-Capability", "/CapabilityName:OpenSSH.Server~~~~0.0.1.0" -Wait -NoNewWindow
    }
}

# تثبيت OpenSSH Client أيضاً (للنفق نفسه)
$sshClient = Get-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 -ErrorAction SilentlyContinue
if (-not $sshClient -or $sshClient.State -ne 'Installed') {
    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 | Out-Null
}

# ═══════════════════════════════════════════════════════════════
# [2/6] تشغيل خدمة SSH
# ═══════════════════════════════════════════════════════════════
Write-Host "🔧 [2/6] تشغيل خدمة SSH..." -ForegroundColor Cyan
Start-Service sshd -ErrorAction SilentlyContinue
Set-Service sshd -StartupType Automatic
$sshStatus = (Get-Service sshd).Status
Write-Host "   ✅ الخدمة: $sshStatus" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# [3/6] فتح Firewall للمنفذ 22
# ═══════════════════════════════════════════════════════════════
Write-Host "🔧 [3/6] فتح Firewall..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' `
        -DisplayName 'OpenSSH Server (sshd)' `
        -Protocol TCP -LocalPort 22 -Action Allow -Enabled True | Out-Null
}
Write-Host "   ✅ المنفذ 22 مسموح" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# [4/6] إنشاء مستخدم Cascade
# ═══════════════════════════════════════════════════════════════
Write-Host "🔧 [4/6] إنشاء مستخدم cascade..." -ForegroundColor Cyan
$user = 'cascade'
$pw = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
$pw += "@Alh!"
$securePw = ConvertTo-SecureString $pw -AsPlainText -Force

if (Get-LocalUser -Name $user -ErrorAction SilentlyContinue) {
    Set-LocalUser -Name $user -Password $securePw
    Write-Host "   ✅ موجود — تم تحديث كلمة المرور" -ForegroundColor Green
} else {
    New-LocalUser -Name $user -Password $securePw `
        -AccountNeverExpires -PasswordNeverExpires `
        -FullName "Cascade Integration" `
        -Description "Temporary user for Alham system integration" | Out-Null
    Add-LocalGroupMember -Group 'Administrators' -Member $user | Out-Null
    Write-Host "   ✅ أُنشئ المستخدم: $user" -ForegroundColor Green
}

# حفظ بيانات الاتصال
$credFile = "$env:USERPROFILE\Desktop\cascade-credentials.txt"
@"
═══════════════════════════════════════════════════════════
   بيانات اتصال Cascade بالسيرفر
   تاريخ: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
═══════════════════════════════════════════════════════════

Username : $user
Password : $pw
Host     : (سيظهر بعد بدء النفق — tcp://xxx.a.pinggy.link:PORT)

⚠️ تنبيه أمني:
- كلمة المرور صالحة حتى يُحذف المستخدم
- عند الانتهاء: شغّل في PowerShell:
    Remove-LocalUser -Name cascade
═══════════════════════════════════════════════════════════
"@ | Out-File -FilePath $credFile -Encoding UTF8

Write-Host "   📝 بيانات الاتصال محفوظة في:" -ForegroundColor Yellow
Write-Host "      $credFile" -ForegroundColor Yellow

# ═══════════════════════════════════════════════════════════════
# [5/6] اختبار SSH محلياً
# ═══════════════════════════════════════════════════════════════
Write-Host "🔧 [5/6] اختبار SSH محلياً..." -ForegroundColor Cyan
$testPort = Test-NetConnection -ComputerName localhost -Port 22 -WarningAction SilentlyContinue
if ($testPort.TcpTestSucceeded) {
    Write-Host "   ✅ SSH يستمع على المنفذ 22" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ SSH لا يستمع — محاولة إعادة تشغيل..." -ForegroundColor Yellow
    Restart-Service sshd -Force
}

# ═══════════════════════════════════════════════════════════════
# [6/6] بدء النفق عبر pinggy.io
# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   🌐 بدء النفق عبر pinggy.io                              ║" -ForegroundColor Magenta
Write-Host "║                                                          ║" -ForegroundColor Magenta
Write-Host "║   🚨 انسخ السطر الذي يبدأ بـ tcp://                      ║" -ForegroundColor Yellow
Write-Host "║       (سيظهر خلال ثوانٍ)                                  ║" -ForegroundColor Yellow
Write-Host "║                                                          ║" -ForegroundColor Magenta
Write-Host "║   📋 أرسله لي + كلمة المرور من الملف أعلاه                ║" -ForegroundColor Yellow
Write-Host "║                                                          ║" -ForegroundColor Magenta
Write-Host "║   ⏱️ النفق يستمر 60 دقيقة (مجاناً)                        ║" -ForegroundColor Yellow
Write-Host "║       لا تُغلق هذه النافذة                                ║" -ForegroundColor Yellow
Write-Host "║                                                          ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Start-Sleep -Seconds 2

# تشغيل النفق (يبقى مفتوحاً)
& ssh -p 443 -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -R0:localhost:22 a.pinggy.io
