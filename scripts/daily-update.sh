#!/bin/bash
set -e

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# launchd запускает скрипт с урезанным PATH без node из nvm — подгружаем nvm (версия default)
if ! command -v node >/dev/null 2>&1; then
	export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
	[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
if ! command -v node >/dev/null 2>&1; then
	echo "$LOG_PREFIX node not found: not in PATH ($PATH) and not loadable from nvm ($NVM_DIR)" >&2
	exit 127
fi

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
