<#
.SYNOPSIS
Detect hardcoded Chinese strings in frontend production code (i18n gate)
.DESCRIPTION
Scan .ts/.tsx files under src/, identify string literals containing Chinese
that are NOT in comments, console logs, imports, SQL keywords, URLs, or i18n
definition tables (LocaleContext zhCNTranslations/enUSTranslations).
.PARAMETER BaselineCount
    Maximum allowed hardcoded count (default 0 for CI strict mode)
.EXAMPLE
powershell -File scripts/check-hardcoded-i18n.ps1
powershell -File scripts/check-hardcoded-i18n.ps1 -BaselineCount 30
#>

[CmdletBinding()]
param(
    [int]$BaselineCount = 0
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "=== Hardcoded Chinese Detection (i18n Gate) ===" -ForegroundColor Cyan
Write-Host "Scan path: src/ (excludes __tests__/generated/node_modules)" -ForegroundColor Gray
Write-Host "Baseline threshold: $BaselineCount" -ForegroundColor Gray
Write-Host ""

# CJK character range
$cjkPattern = '[一-鿿]'

$scanDirs = @(
    'src/components',
    'src/pages',
    'src/store',
    'src/services',
    'src/utils',
    'src/context',
    'src/types'
)

# Exclusion rules: lines that match these patterns are skipped
$exclusionRules = @(
    '^\s*//',
    '/\*',
    '\bconsole\.(log|warn|error|info|debug)\s*\(',
    '\baddToast\s*\(\s*[''"]',
    'https?://',
    '/[^^]/',
    '^\s*import\s',
    '\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|TABLE|INDEX)\b\s',
    'zhCNTranslations|enUSTranslations',
    '^\s*\*',
    '\$\{',
    'tooltip|formatter|renderer|cellRendererValue',
    '__tests__',
    '\*\*',
    'RegExp|new RegExp'
)

$files = @()
foreach ($dir in $scanDirs) {
    if (-not (Test-Path $dir)) { continue }
    $files += Get-ChildItem -Path $dir -Include *.ts,*.tsx -Recurse | Where-Object {
        $_.FullName -notmatch '__tests__|node_modules|generated'
    }
}

$results = @()
$totalCount = 0

foreach ($file in $files) {
    $lines = Get-Content $file.FullName -Encoding UTF8
    $fileRel = $file.FullName.Replace("$projectRoot\", "")
    $lineHits = @()

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -notmatch $cjkPattern) { continue }

        $excluded = $false
        foreach ($rule in $exclusionRules) {
            if ($line -match $rule) {
                $excluded = $true
                break
            }
        }
        if ($excluded) { continue }

        $lineHits += [PSCustomObject]@{
            Line    = $i + 1
            Content = $line.Trim()
        }
    }

    if ($lineHits.Count -gt 0) {
        $results += [PSCustomObject]@{
            File     = $fileRel
            HitCount = $lineHits.Count
            Lines    = $lineHits
        }
        $totalCount += $lineHits.Count
    }
}

Write-Host "Files scanned: $($files.Count)" -ForegroundColor White
Write-Host "Files with hardcoded Chinese: $($results.Count)" -ForegroundColor White
Write-Host "Total hardcoded hits: $totalCount" -ForegroundColor $(if ($totalCount -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ""

if ($totalCount -gt 0) {
    Write-Host "=== Hardcoded Details (grouped by file) ===" -ForegroundColor Yellow
    Write-Host ""
    foreach ($r in $results | Sort-Object HitCount -Descending) {
        Write-Host "FILE: $($r.File) ($($r.HitCount) hits)" -ForegroundColor White
        foreach ($l in $r.Lines) {
            $preview = if ($l.Content.Length -gt 140) { $l.Content.Substring(0, 140) + '...' } else { $l.Content }
            Write-Host "  L$($l.Line): $preview" -ForegroundColor Gray
        }
        Write-Host ""
    }
}

if ($totalCount -le $BaselineCount) {
    Write-Host "PASS: hardcoded check passed ($totalCount hits, baseline $BaselineCount)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAIL: hardcoded check failed ($totalCount hits, exceeds baseline $BaselineCount by $($totalCount - $BaselineCount))" -ForegroundColor Red
    Write-Host "Action: Move hardcoded strings to LocaleContext.tsx and use useLocale().t(key)" -ForegroundColor Yellow
    exit 1
}