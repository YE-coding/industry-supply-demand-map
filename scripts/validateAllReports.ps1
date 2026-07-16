$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot '..\.skill-staging\industry-cycle-analysis\scripts\validate_report.py'
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
