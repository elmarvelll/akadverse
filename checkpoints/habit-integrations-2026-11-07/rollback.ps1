param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$projectRoot = [IO.Path]::GetFullPath($manifest.root).TrimEnd('\')
if ($projectRoot -ne 'C:\Productivity Layer\schedule-manager') { throw 'Unexpected project root.' }
$checked = @()
foreach ($entry in $manifest.entries) {
  $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $entry.file))
  if (-not $target.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target leaves project root.' }
  if (-not (Test-Path -LiteralPath $target)) { throw "Missing current file: $target" }
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.after) { throw "Later changes detected: $target. Reconcile manually." }
  $backup = Join-Path (Join-Path $PSScriptRoot 'before') $entry.file
  if ($null -ne $entry.before) {
    if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.before) { throw "Backup mismatch: $backup" }
  }
  $checked += @{Target=$target; Backup=$backup; Existing=($null -ne $entry.before)}
}
if (-not $Apply) { Write-Output 'All source and backup hashes match. No files changed. Pass -Apply to reverse this update.'; exit }
foreach ($item in $checked) {
  if ($item.Existing) { Copy-Item -LiteralPath $item.Backup -Destination $item.Target }
  else { Remove-Item -LiteralPath $item.Target }
}
Write-Output 'Integration source update reversed. User storage was not touched. Rebuild before restarting.'
