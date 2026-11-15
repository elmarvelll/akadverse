param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$analyticsManifestPath = Join-Path $PSScriptRoot 'manifest.json'
$analyticsManifest = Get-Content -LiteralPath $analyticsManifestPath -Raw | ConvertFrom-Json
if ($analyticsManifest.phase -ne 'verified-complete') { throw 'The analytics checkpoint is not finalized.' }
$analyticsRoot = [System.IO.Path]::GetFullPath($analyticsManifest.root).TrimEnd([char]92)
$analyticsPrefix = $analyticsRoot + [System.IO.Path]::DirectorySeparatorChar
$analyticsRestore = @()
$analyticsRemove = @()
function Get-CheckedAnalyticsTarget([string]$relative) {
  $analyticsTarget = [System.IO.Path]::GetFullPath((Join-Path $analyticsRoot $relative))
  if (-not $analyticsTarget.StartsWith($analyticsPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw ('Target outside application: ' + $relative) }
  return $analyticsTarget
}
# Check every file before making any changes. Later edits require manual merging.
foreach ($analyticsEntry in $analyticsManifest.existing) {
  $analyticsTarget = Get-CheckedAnalyticsTarget $analyticsEntry.path
  $analyticsBackup = Join-Path (Join-Path $PSScriptRoot 'before') $analyticsEntry.path
  if (-not (Test-Path -LiteralPath $analyticsBackup -PathType Leaf)) { throw ('Missing backup: ' + $analyticsEntry.path) }
  if ((Get-FileHash -LiteralPath $analyticsBackup -Algorithm SHA256).Hash -ne $analyticsEntry.beforeHash) { throw ('Backup integrity mismatch: ' + $analyticsEntry.path) }
  if (-not (Test-Path -LiteralPath $analyticsTarget -PathType Leaf)) { throw ('Missing existing source; inspect manually: ' + $analyticsEntry.path) }
  $analyticsCurrentHash = (Get-FileHash -LiteralPath $analyticsTarget -Algorithm SHA256).Hash
  if ($analyticsCurrentHash -eq $analyticsEntry.beforeHash) { continue }
  if ($analyticsCurrentHash -ne $analyticsEntry.afterHash) { throw ('Later edits detected. Merge manually before rollback: ' + $analyticsEntry.path) }
  $analyticsRestore += [pscustomobject]@{ target=$analyticsTarget; backup=$analyticsBackup }
}
foreach ($analyticsEntry in $analyticsManifest.created) {
  $analyticsTarget = Get-CheckedAnalyticsTarget $analyticsEntry.path
  if (-not (Test-Path -LiteralPath $analyticsTarget)) { continue }
  if (-not (Test-Path -LiteralPath $analyticsTarget -PathType Leaf)) { throw ('Expected one file, not a directory: ' + $analyticsEntry.path) }
  if ((Get-FileHash -LiteralPath $analyticsTarget -Algorithm SHA256).Hash -ne $analyticsEntry.afterHash) { throw ('Later edits to new file detected. Preserve/merge manually: ' + $analyticsEntry.path) }
  $analyticsRemove += $analyticsTarget
}
Write-Output ('Verified checkpoint. Restore {0} existing files; remove {1} analytics-created files.' -f $analyticsRestore.Count, $analyticsRemove.Count)
if ($CheckOnly) { Write-Output 'Check only: no application files changed.'; return }
foreach ($analyticsEntry in $analyticsRestore) { Copy-Item -LiteralPath $analyticsEntry.backup -Destination $analyticsEntry.target -Force }
foreach ($analyticsTarget in $analyticsRemove) { Remove-Item -LiteralPath $analyticsTarget }
Write-Output 'Analytics source rollback completed. No records, storage schemas, package files or lockfiles changed. Rebuild before restarting the local server.'
