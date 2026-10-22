# Dot-source me (PowerShell):  . scripts/env.ps1
# Repo-local toolchain: puts the portable Node from .tools/ on PATH and points every cache,
# temp dir and tool download at .tools/, so nothing is written to $HOME or system locations.
$apexRoot = Split-Path -Parent $PSScriptRoot
$apexNode = Get-ChildItem "$apexRoot\.tools" -Directory -Filter 'node-v*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apexNode) { $env:Path = "$($apexNode.FullName);$env:Path" }
else { Write-Warning "scripts/env.ps1: no portable Node found in .tools/ (expected .tools/node-v*)" }
New-Item -ItemType Directory -Force "$apexRoot\.tools\tmp" | Out-Null
$env:npm_config_cache = "$apexRoot\.tools\npm-cache"
$env:npm_config_update_notifier = 'false'
$env:npm_config_fund = 'false'
$env:npm_config_audit = 'false'
$env:TMP = "$apexRoot\.tools\tmp"; $env:TEMP = $env:TMP; $env:TMPDIR = $env:TMP
$env:PLAYWRIGHT_BROWSERS_PATH = "$apexRoot\.tools\ms-playwright"
$env:NODE_REPL_HISTORY = ''
