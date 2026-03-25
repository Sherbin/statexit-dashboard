#!/bin/bash
# Check input text for forbidden words from config.local.json
# Usage: echo "text" | ./check-forbidden-words.sh [context-label]

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SETTINGS_FILE="$SCRIPT_DIR/config.local.json"

if [ ! -f "$SETTINGS_FILE" ]; then
	exit 0
fi

WORDS=$(node -e "
const f = require('$SETTINGS_FILE');
if (Array.isArray(f.forbiddenWords) && f.forbiddenWords.length > 0) {
	console.log(f.forbiddenWords.join('|'));
}
" 2>/dev/null)

if [ -z "$WORDS" ]; then
	exit 0
fi

CONTEXT="${1:-input}"
INPUT=$(cat)

MATCHES=$(echo "$INPUT" | grep -inE "$WORDS" || true)

if [ -n "$MATCHES" ]; then
	echo "ERROR: Forbidden words found in $CONTEXT:"
	echo "$MATCHES"
	echo ""
	echo "Blocked words pattern: $WORDS"
	exit 1
fi

exit 0
