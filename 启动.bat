@echo off
chcp 65001 >nul
title Resume Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js not found. Please install Node.js 18+ from https://nodejs.org
  echo 没有找到 Node.js，请先安装 Node.js 18 或更高版本：https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo 正在启动简历工作台...
node server.mjs

if errorlevel 1 pause
