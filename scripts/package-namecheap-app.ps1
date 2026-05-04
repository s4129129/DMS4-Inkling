$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$stage = Join-Path $root ".package-namecheap-app"
$output = Join-Path $root "deploy-namecheap-app.zip"

if (!(Test-Path $dist)) {
  throw "Missing dist directory. Run npm run build:prod first."
}

$resolvedStageParent = Resolve-Path $root
if (([IO.Path]::GetFullPath($stage)).StartsWith(([IO.Path]::GetFullPath($resolvedStageParent)), [StringComparison]::OrdinalIgnoreCase) -eq $false) {
  throw "Refusing to package outside the project directory."
}

if (Test-Path $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
if (Test-Path $output) {
  Remove-Item -LiteralPath $output -Force
}

New-Item -ItemType Directory -Path $stage | Out-Null

$distFullPath = [IO.Path]::GetFullPath($dist)
Get-ChildItem -Path $dist -Recurse -File | Where-Object {
  $_.FullName -notmatch "\\official\\.*\.pdf$"
} | ForEach-Object {
  $relativePath = $_.FullName.Substring($distFullPath.Length).TrimStart("\", "/")
  $targetPath = Join-Path $stage $relativePath
  $targetDirectory = Split-Path $targetPath -Parent
  if (!(Test-Path $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
  }
  Copy-Item -LiteralPath $_.FullName -Destination $targetPath
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $output -Force
Remove-Item -LiteralPath $stage -Recurse -Force

Write-Host "Created $output"
