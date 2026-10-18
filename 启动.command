#!/bin/bash
# 双击这个文件即可启动「简历工作台」
cd "$(dirname "$0")" || exit 1

# Finder 双击时 PATH 可能很精简，把常见 node 位置补上
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "没有找到 Node.js。"
  echo "请先安装 Node.js（https://nodejs.org），或运行：brew install node"
  echo ""
  read -n 1 -s -r -p "按任意键关闭这个窗口…"
  exit 1
fi

echo "正在启动简历工作台…"
exec node server.mjs
