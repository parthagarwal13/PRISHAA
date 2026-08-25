@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env
echo PRISHAA backend setup
echo Edit .env and add your Neon DATABASE_URL first.
pause
