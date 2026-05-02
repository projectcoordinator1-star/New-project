param(
  [string]$Message = "",
  [switch]$IncludeUploads,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

function Write-Step($Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Require-Command($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue

  if (-not $command) {
    throw "$Name is not installed or not available in PATH."
  }
}

Require-Command git

$repoRoot = git rev-parse --show-toplevel 2>$null

if (-not $repoRoot) {
  throw "This folder is not inside a Git repository."
}

Set-Location $repoRoot

$branch = (git branch --show-current).Trim()

if (-not $branch) {
  throw "No active Git branch found. Please checkout a branch first."
}

$origin = (git remote get-url origin 2>$null).Trim()

if (-not $origin) {
  throw "Git remote 'origin' is missing. Add your GitHub remote before pushing."
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = Read-Host "Commit message"
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  throw "Commit message cannot be empty."
}

Write-Step "Repository"
Write-Host "Root   : $repoRoot"
Write-Host "Branch : $branch"
Write-Host "Remote : $origin"

Write-Step "Staging changes"

if ($IncludeUploads) {
  git add -A -- .
} else {
  git add -A -- . ':!uploads/' ':!server-8787.out.log' ':!server-8787.err.log'
}

$staged = git diff --cached --name-only

if (-not $staged) {
  Write-Host "No changes to commit." -ForegroundColor Yellow
  exit 0
}

Write-Host "Files staged:"
$staged | ForEach-Object { Write-Host " - $_" }

Write-Step "Creating commit"
git commit -m $Message

if ($NoPush) {
  Write-Host ""
  Write-Host "Commit created. Push skipped because -NoPush was used." -ForegroundColor Yellow
  exit 0
}

Write-Step "Pushing to GitHub"
git push -u origin $branch

Write-Host ""
Write-Host "Commit pushed successfully." -ForegroundColor Green
