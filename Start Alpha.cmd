@echo off
cd /d "%~dp0"
node scripts/start-options-workbench.mjs
if errorlevel 1 pause
