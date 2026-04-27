$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vsDevCmd = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat'

if (-not (Test-Path $vsDevCmd)) {
  throw "VsDevCmd.bat not found: $vsDevCmd"
}

$hook = Join-Path $root 'hookdll.cpp'
$launcher = Join-Path $root 'launcher.cpp'
$vb6ar = Join-Path $root 'vb6ar_stub.c'
$vbame = Join-Path $root 'vbame_stub.c'

$cmd = @"
call "$vsDevCmd" -arch=x86 -host_arch=x64 >nul
cd /d "$root"
cl /nologo /std:c++17 /EHsc /DUNICODE /D_UNICODE /LD "$hook" /Fe:ecas-hook.dll /link /MACHINE:X86 ole32.lib oleaut32.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /EHsc /DUNICODE /D_UNICODE "$launcher" /Fe:ecas-launcher.exe /link /MACHINE:X86
if errorlevel 1 exit /b 1
cl /nologo /DUNICODE /D_UNICODE /LD "$vb6ar" /Fe:VB6AR.dll /link /MACHINE:X86
if errorlevel 1 exit /b 1
cl /nologo /DUNICODE /D_UNICODE /LD "$vbame" /Fe:VBAME.dll /link /MACHINE:X86
"@

cmd.exe /d /s /c $cmd
if ($LASTEXITCODE -ne 0) {
  throw "build failed with exit code $LASTEXITCODE"
}

$artifacts = @(
  (Join-Path $root 'ecas-hook.dll'),
  (Join-Path $root 'ecas-launcher.exe'),
  (Join-Path $root 'VB6AR.dll'),
  (Join-Path $root 'VBAME.dll'),
  (Join-Path $root 'vb6ar_stub.dll')
) | Where-Object { Test-Path $_ }

Get-Item $artifacts |
  Select-Object FullName, Length, LastWriteTime
