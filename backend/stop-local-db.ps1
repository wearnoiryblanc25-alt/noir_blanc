$ErrorActionPreference = 'Stop'

$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDir = Join-Path $PSScriptRoot '.postgres-data'

if (-not (Test-Path $pgCtl)) {
  throw "No se encontro pg_ctl.exe en $pgCtl."
}

if (-not (Test-Path $dataDir)) {
  throw "No se encontro el directorio de datos local en $dataDir."
}

& $pgCtl -D $dataDir -w stop

if ($LASTEXITCODE -ne 0) {
  throw "No fue posible detener PostgreSQL local. Codigo: $LASTEXITCODE"
}
