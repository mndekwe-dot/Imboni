<#
PowerShell helper to remove Backend/Imboni/.env from the index and optionally purge history using git-filter-repo.
Review before running. Run from the repository root in PowerShell.
#>
param(
    [switch]$PurgeHistory
)

Write-Host "Step 1: remove Backend/Imboni/.env from index (keeps local file)"
git rm --cached Backend/Imboni/.env
if ($LASTEXITCODE -ne 0) {
    Write-Host "git rm returned non-zero exit code; verify the path and run the command manually." -ForegroundColor Yellow
} else {
    git commit -m "Remove committed Backend/Imboni/.env"
    git push origin HEAD
}

if ($PurgeHistory) {
    Write-Host "Step 2: purging history with git-filter-repo"
    # Check for git-filter-repo
    $gfr = Get-Command git-filter-repo -ErrorAction SilentlyContinue
    if (-not $gfr) {
        Write-Host "git-filter-repo not found. Install with: python -m pip install --user git-filter-repo" -ForegroundColor Yellow
        exit 1
    }

    # Run purge
    git filter-repo --path Backend/Imboni/.env --invert-paths --force
    if ($LASTEXITCODE -ne 0) {
        Write-Host "git filter-repo failed. Inspect output above." -ForegroundColor Red
        exit 1
    }

    Write-Host "Force-pushing rewritten history to origin (all branches and tags)."
    git push origin --force --all
    git push origin --force --tags
    Write-Host "Done. Notify collaborators: they must re-clone the repository." -ForegroundColor Green
}

Write-Host "Reminder: rotate any exposed secrets (Django SECRET_KEY, API keys, SMTP, etc.)." -ForegroundColor Cyan