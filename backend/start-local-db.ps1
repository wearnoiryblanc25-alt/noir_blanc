$ErrorActionPreference = 'Stop'

$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDir = Join-Path $PSScriptRoot '.postgres-data'
$logFile = Join-Path $dataDir 'server.log'
$port = 55432

if (-not (Test-Path $pgCtl)) {
  throw "No se encontro pg_ctl.exe en $pgCtl."
}

if (-not (Test-Path $dataDir)) {
  throw "No se encontro el directorio de datos local en $dataDir."
}

& $pgCtl -D $dataDir -l $logFile -o "-p $port -h 127.0.0.1" -w start

if ($LASTEXITCODE -ne 0) {
  throw "No fue posible iniciar PostgreSQL local. Codigo: $LASTEXITCODE"
}
