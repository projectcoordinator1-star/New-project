@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-git-commit-push.ps1" %*
