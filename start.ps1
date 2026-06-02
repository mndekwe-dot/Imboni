# Imboni dev launcher — starts Django and Vite in separate terminal windows.
# Usage: .\start.ps1
# Requires: benv\ virtual environment in the project root.

# Resolve the project root from wherever this script lives
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Django backend — activates benv, then runs the dev server on http://127.0.0.1:8000
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Write-Host 'Backend' -ForegroundColor Cyan; cd '$root\Backend'; ..\benv\Scripts\Activate.ps1; python manage.py runserver"

# Vite frontend — runs the React dev server on http://localhost:5173
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Write-Host 'Frontend' -ForegroundColor Green; cd '$root\Frontend'; npm run dev"
