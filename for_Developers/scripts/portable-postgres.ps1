param([ValidateSet('start', 'stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$directory = Join-Path $workspace '.local-development'
$bin = Join-Path $directory 'tools\pgsql\bin'
$data = Join-Path $directory 'postgres-data'
$pgCtl = Join-Path $bin 'pg_ctl.exe'
if (!(Test-Path -LiteralPath $pgCtl)) {
  throw 'Portable PostgreSQL tools are missing. Use Docker (npm run db:local:up), or extract the official Windows binaries into .local-development/tools/pgsql first. See docs/productivity-release.md.'
}
$running = $false
if (Test-Path -LiteralPath (Join-Path $data 'PG_VERSION')) {
  & $pgCtl -D $data status 2>&1 | Out-Null
  $running = $LASTEXITCODE -eq 0
}
if ($Action -eq 'stop') {
  if ($running) { & $pgCtl -D $data -m fast -w stop; exit $LASTEXITCODE }
  Write-Output 'Portable PostgreSQL is already stopped.'
  exit 0
}
if (!(Test-Path -LiteralPath (Join-Path $data 'PG_VERSION'))) {
  if (Test-Path -LiteralPath $data) { throw 'An incomplete PostgreSQL data directory exists; inspect it before retrying.' }
  [IO.Directory]::CreateDirectory($directory) | Out-Null
  $passwordFile = Join-Path $directory 'local-postgres-password'
  [IO.File]::WriteAllText($passwordFile, 'akadverse_local_only')
  & (Join-Path $bin 'initdb.exe') -D $data -U akadverse --pwfile=$passwordFile --auth=scram-sha-256 --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (!$running) {
  & $pgCtl -D $data -l (Join-Path $directory 'postgres.log') -o '-h 127.0.0.1 -p 5433' -w start
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$env:PGHOST = '127.0.0.1'; $env:PGPORT = '5433'; $env:PGUSER = 'akadverse'; $env:PGPASSWORD = 'akadverse_local_only'
foreach ($database in @('akadverse', 'akadverse_elearning')) {
  $exists = & (Join-Path $bin 'psql.exe') -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database'"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($exists -ne '1') {
    & (Join-Path $bin 'createdb.exe') $database
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
Write-Output 'Portable PostgreSQL is ready on 127.0.0.1:5433. Data is retained in .local-development/postgres-data.'
