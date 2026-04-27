Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

Start-Sleep -Seconds 2

# ابحث عن نافذة ECAS
$ecas = Get-Process | Where-Object { $_.MainWindowTitle -like "*Electricity*" -or $_.MainWindowTitle -like "*ECAS*" -or $_.MainWindowTitle -like "*Customers*" -or $_.ProcessName -like "*Electricity*" }

if (-not $ecas) {
    Write-Host "ECAS not found, listing all windows:"
    Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object ProcessName, MainWindowTitle | Format-Table
    exit
}

Write-Host "Found ECAS: $($ecas.MainWindowTitle) (PID: $($ecas.Id))"

# اجعل النافذة في المقدّمة
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

[Win32]::ShowWindow($ecas.MainWindowHandle, 9) # SW_RESTORE
Start-Sleep -Milliseconds 500
[Win32]::SetForegroundWindow($ecas.MainWindowHandle)
Start-Sleep -Milliseconds 500

# التقط صورة للشاشة لنشوف ماذا يظهر
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$bitmap.Save("d:\almham\backend\scripts\ecas-screenshot.png")
$graphics.Dispose()
$bitmap.Dispose()
Write-Host "Screenshot saved to ecas-screenshot.png"
Write-Host "Window title: $($ecas.MainWindowTitle)"
