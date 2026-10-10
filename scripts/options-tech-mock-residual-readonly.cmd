@echo off
setlocal
rem Process-local settings only. No npm, tsx, PowerShell profile, or global config.
set "NODE_OPTIONS="
set "NODE_COMPILE_CACHE="
set "NODE_V8_COVERAGE="
set "NODE_REPL_HISTORY="
set "NODE_DISABLE_COMPILE_CACHE=1"
set "TSX_DISABLE_CACHE=1"
node --permission --allow-fs-read=* --no-addons "%~dp0options-tech-mock-residual-readonly.mjs" %*
exit /b %errorlevel%
