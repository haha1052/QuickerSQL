<#
.SYNOPSIS
检查架构现状.md 与代码实际状态是否同步
.DESCRIPTION
验证项：
  1. 版本号三处一致（package.json / Cargo.toml / tauri.conf.json）—— 硬性检查
  2. 系统表数量一致（lib.rs 注释声明 vs 架构现状.md §10 标题声明 vs §10.1 表格行数）—— 硬性检查
  3. 架构现状.md 记录的应用版本与实际版本一致 —— 警告级（不阻断退出码）
注：测试数量因频繁变化未纳入检查，避免噪声。
.EXAMPLE
pwsh scripts/check-doc-sync.ps1
#>

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$errors = @()
$warnings = @()

# ---------- 1. 版本号三处一致 ----------
$pkgVersion = (Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$cargoMatch = Select-String -Path src-tauri/Cargo.toml -Pattern '^version\s*=\s*"([^"]+)"'
$cargoVersion = if ($cargoMatch) { $cargoMatch.Matches[0].Groups[1].Value } else { '<未找到>' }
$tauriMatch = Select-String -Path src-tauri/tauri.conf.json -Pattern '"version":\s*"([^"]+)"'
$tauriVersion = if ($tauriMatch) { $tauriMatch.Matches[0].Groups[1].Value } else { '<未找到>' }

if ($pkgVersion -ne $cargoVersion) {
    $errors += "版本不一致: package.json=$pkgVersion vs Cargo.toml=$cargoVersion"
}
if ($pkgVersion -ne $tauriVersion) {
    $errors += "版本不一致: package.json=$pkgVersion vs tauri.conf.json=$tauriVersion"
}
Write-Host "版本号: package.json=$pkgVersion, Cargo.toml=$cargoVersion, tauri.conf.json=$tauriVersion"

# ---------- 2. 系统表数量一致 ----------
# 2a. lib.rs 注释中声明的系统表数量（"统一初始化 N 张系统表"）
$libRsContent = Get-Content src-tauri/src/lib.rs -Raw -Encoding UTF8
$libDeclaredMatch = [regex]::Match($libRsContent, '(\d+)\s*张系统表')
$libDeclaredCount = if ($libDeclaredMatch.Success) { [int]$libDeclaredMatch.Groups[1].Value } else { 0 }
if (-not $libDeclaredMatch.Success) {
    $errors += "lib.rs 中未找到 'N 张系统表' 声明"
}

# 2b. 架构现状.md §10 标题声明的数量（"系统表清单（N 张）"，兼容全角/半角括号）
$docContent = Get-Content 'docs/架构现状.md' -Raw -Encoding UTF8
$docTitleMatch = [regex]::Match($docContent, '系统表清单[（(]\s*(\d+)\s*张[）)]')
$docDeclaredCount = if ($docTitleMatch.Success) { [int]$docTitleMatch.Groups[1].Value } else { 0 }
if (-not $docTitleMatch.Success) {
    $errors += "架构现状.md §10 标题中未找到 '系统表清单（N 张）' 声明"
}

# 2c. 架构现状.md §10.1 表格实际行数（| 序号 | `__xxx` | ...）
$docTableRows = [regex]::Matches($docContent, '\|\s*\d+\s*\|\s*`__\w+`')
$docActualCount = $docTableRows.Count

Write-Host "系统表数量: lib.rs 声明=$libDeclaredCount, 文档标题声明=$docDeclaredCount, 文档表格行数=$docActualCount"

if ($libDeclaredCount -gt 0 -and $docDeclaredCount -gt 0 -and $libDeclaredCount -ne $docDeclaredCount) {
    $errors += "系统表数量不一致: lib.rs 声明 $libDeclaredCount 张 vs 文档 §10 标题 $docDeclaredCount 张"
}
if ($docDeclaredCount -gt 0 -and $docDeclaredCount -ne $docActualCount) {
    $errors += "系统表数量不一致: 文档 §10 标题 $docDeclaredCount 张 vs §10.1 表格 $docActualCount 行"
}

# ---------- 3. 文档记录的应用版本 vs 实际版本（警告级，不阻断） ----------
# 架构现状.md §6.1 "应用版本" 行内提取版本号
$docVersionMatch = [regex]::Match($docContent, '应用版本.*?(\d+\.\d+\.\d+)')
$docRecordedVersion = if ($docVersionMatch.Success) { $docVersionMatch.Groups[1].Value } else { '' }
if ($docVersionMatch.Success -and $docRecordedVersion -ne $pkgVersion) {
    $warnings += "架构现状.md §6.1 记录应用版本为 $docRecordedVersion，与实际 $pkgVersion 不一致（文档可能未同步版本升级）"
} elseif (-not $docVersionMatch.Success) {
    $warnings += "架构现状.md 中未找到 '应用版本' 记录，无法校验"
}

# ---------- 输出 ----------
if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️ 警告（不阻断）:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ 文档同步检查失败:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host ""
    Write-Host "✅ 文档同步检查通过（硬性检查项全部一致）" -ForegroundColor Green
    exit 0
}
