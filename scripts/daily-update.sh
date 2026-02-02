#!/bin/bash
set -e

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TV_REPO="/Users/sscherbin/code/tradingview2"

echo "$LOG_PREFIX Starting daily update..."

# Синхронизация tradingview2 с origin
echo "$LOG_PREFIX Syncing tradingview2..."
cd "$TV_REPO"
git pull
echo "$LOG_PREFIX tradingview2 synced to $(git rev-parse --short HEAD)"

# Запуск сбора статистики
echo "$LOG_PREFIX Running statexit-dashboard..."
cd "$SCRIPT_DIR"
npm run build
npm run start -- --config config.json --until-yesterday

echo "$LOG_PREFIX Done!"
