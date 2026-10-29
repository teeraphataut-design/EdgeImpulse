param(
  [string]$EnvName = "Cloud",
  [string]$Username = $env:TB_USERNAME,
  [string]$Password = $env:TB_PASSWORD
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$resultsDir = Join-Path $root "results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$jsonPath = Join-Path $resultsDir "$stamp.json"
$htmlPath = Join-Path $resultsDir "$stamp.html"

Push-Location $root
try {
  $bruArgs = @("run", "--env", $EnvName, "--reporter-json", $jsonPath, "--reporter-html", $htmlPath)
  if ($Username -and $Password) {
    $bruArgs += @("--env-var", "username=$Username", "--env-var", "password=$Password")
  }
  npx bru @bruArgs
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

Copy-Item $jsonPath (Join-Path $resultsDir "latest.json") -Force
Copy-Item $htmlPath (Join-Path $resultsDir "latest.html") -Force

Write-Host "Saved run to $jsonPath (and copied to results/latest.json)"
exit $exitCode
