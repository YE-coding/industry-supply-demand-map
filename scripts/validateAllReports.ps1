$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot '..\.skill-staging\industry-cycle-analysis\scripts\validate_report.py'
$corpusValidator = Join-Path $PSScriptRoot '..\.skill-staging\industry-cycle-analysis\scripts\validate_corpus.py'
$repoRoot = Split-Path -Parent $PSScriptRoot
$reports = @(Get-ChildItem -LiteralPath $repoRoot -File -Filter '*.md' | Where-Object { $_.Name -match '^\d+_' } | Sort-Object Name)
if ($reports.Count -eq 0) {
    throw "No industry reports found under $repoRoot"
}
$failed = @()
foreach ($report in $reports) {
    & python $validator $report.FullName --mode full --strict
    if ($LASTEXITCODE -ne 0) { $failed += $report.Name }
}
if ($failed.Count -gt 0) {
    throw "Strict validation failed: $($failed -join ', ')"
}
Write-Host "Strict validation passed for $($reports.Count) reports."

$benchmark = $reports | Where-Object { $_.Name -like '01_*' } | Select-Object -First 1
if (-not $benchmark) {
    throw 'Semiconductor benchmark report (01_*.md) is missing.'
}
& python $corpusValidator $repoRoot --pattern '??_*.md' --benchmark $benchmark.FullName --strict
if ($LASTEXITCODE -ne 0) {
    throw 'Corpus validation failed.'
}
Write-Host 'Corpus validation passed with zero errors and zero warnings.'
