#!/bin/bash
set -e

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TV_REPO=$(node -e "console.log(require('$SCRIPT_DIR/config.local.json').repo)")

echo "$LOG_PREFIX Starting daily update..."

# Синхронизация source repo с origin
echo "$LOG_PREFIX Syncing source repo..."
cd "$TV_REPO"
git pull
echo "$LOG_PREFIX Source repo synced to $(git rev-parse --short HEAD)"

# Запуск сбора статистики
echo "$LOG_PREFIX Running statexit-dashboard..."
cd "$SCRIPT_DIR"
npm run build
npm run start -- --config config.local.json --until-yesterday

echo "$LOG_PREFIX Done!"
