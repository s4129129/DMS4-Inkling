$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$official = Join-Path $root "dist\official"
$output = Join-Path $root "deploy-namecheap-book-assets.zip"

if (!(Test-Path $official)) {
  throw "Missing dist\official directory. Run npm run build:prod first."
}

if (Test-Path $output) {
  Remove-Item -LiteralPath $output -Force
}

Compress-Archive -Path (Join-Path $official "*") -DestinationPath $output -Force

Write-Host "Created $output"
