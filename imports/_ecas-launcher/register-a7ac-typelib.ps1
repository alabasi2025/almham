$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$idlPath = Join-Path $root 'typelib\\a7ac-placeholder.idl'
$tlbPath = Join-Path $root 'typelib\\a7ac-placeholder.tlb'

$midlCandidates = @(
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x86\\midl.exe',
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\midl.exe'
)
$clCandidates = @(
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostx64\\x86\\cl.exe',
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostx86\\x86\\cl.exe'
)
$sdkIncludeRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\Include\\10.0.26100.0'

$midl = $midlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $midl) {
  throw 'midl.exe غير موجود'
}

$cl = $clCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cl) {
  throw 'cl.exe غير موجود'
}

$env:PATH = "$(Split-Path -Parent $cl);$env:PATH"
$env:INCLUDE = "$sdkIncludeRoot\\um;$sdkIncludeRoot\\shared;$sdkIncludeRoot\\winrt;$env:INCLUDE"

if (-not (Test-Path $idlPath)) {
  throw "IDL file not found: $idlPath"
}

$typelibDir = Split-Path -Parent $tlbPath
New-Item -ItemType Directory -Force -Path $typelibDir | Out-Null

Push-Location $typelibDir
try {
  & $midl /nologo /tlb (Split-Path -Leaf $tlbPath) /h NUL /iid NUL /proxy NUL /dlldata NUL (Split-Path -Leaf $idlPath)
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tlbPath)) {
    throw "MIDL failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$guid = '{A7AC8459-490C-40B1-B475-3A380430718B}'
$baseKey = "HKCU:\\Software\\Classes\\TypeLib\\$guid\\1.0"

New-Item -Path $baseKey -Force -Value 'ECAS Placeholder Type Library' | Out-Null
New-Item -Path "$baseKey\\0\\win32" -Force -Value $tlbPath | Out-Null
New-Item -Path "$baseKey\\409\\win32" -Force -Value $tlbPath | Out-Null
New-Item -Path "$baseKey\\401\\win32" -Force -Value $tlbPath | Out-Null
New-Item -Path "$baseKey\\FLAGS" -Force -Value '0' | Out-Null
New-Item -Path "$baseKey\\HELPDIR" -Force -Value $typelibDir | Out-Null

Write-Output "Registered placeholder typelib at: $tlbPath"
