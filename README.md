# Migration Progress Dashboard

CLI-инструмент для отслеживания прогресса миграции кода между папками, основанный на git-истории.

## Возможности

-   📊 Анализирует git-историю source-репозитория
-   📈 Считает строки кода в старой и новой папках
-   📅 Агрегирует данные по дням (последний коммит дня)
-   🔄 Инкрементальное обновление (только новые дни)
-   📤 Автоматический коммит и пуш результатов
-   🌐 GitHub Pages дашборд с charts

## Установка

```bash
npm install
npm run build
cp config.json config.local.json  # создать локальный конфиг
# отредактировать config.local.json под свой репозиторий
```

## Использование

```bash
node dist/cli.js \
  --repo /path/to/source-repo \
  --old src/legacy \
  --new src/new \
  --output ./docs/progress.json
```

### Параметры

| Параметр   | Описание                                                  |
| ---------- | --------------------------------------------------------- |
| `--repo`   | Абсолютный путь к source-репозиторию                      |
| `--old`    | Путь к старой папке (относительно repo)                   |
| `--new`    | Путь к новой папке (относительно repo)                    |
| `--output` | Путь к выходному JSON файлу                               |
| `--force`  | Пересчитать всё с нуля (игнорировать существующие данные) |

## Логика анализа

1. **Точка старта**: Первый коммит, где ОБЕ папки существуют одновременно
2. **Выборка**: Для каждого дня берётся последний коммит (UTC)
3. **Подсчёт**: Непустые строки во всех текстовых файлах
4. **Инкремент**: Анализируются только новые дни

## Формат данных

```json
{
	"meta": {
		"sourceRepo": "git@github.com:org/repo.git",
		"oldPath": "src/legacy",
		"newPath": "src/new",
		"generatedAt": "2024-01-01T00:00:00.000Z"
	},
	"data": [
		{
			"time": 1704067200,
			"oldSizeKB": 12345,
			"newSizeKB": 6789,
			"oldFiles": 234,
			"newFiles": 123,
			"comment": "Optional explanation for anomalies"
		}
	]
}
```

### Comments Field (v2)

The optional `comment` field can be added to any data point to explain anomalies or significant changes. Comments will appear in the dashboard tooltip with a distinctive orange warning icon.

**Example:**

```json
{
	"time": 1754179200,
	"oldSizeKB": 139294,
	"newSizeKB": 12,
	"oldFiles": 23576,
	"newFiles": 14,
	"comment": "Test data spike: tzdata.test (4.1M lines) added, moved to isolated package next day"
}
```

## GitHub Pages

После генерации `progress.json` дашборд доступен через GitHub Pages:

1. Включите GitHub Pages для папки `/docs`
2. Откройте `https://<username>.github.io/<repo>/`

## Local Development

To view the dashboard locally:

```bash
npm run serve
```

Then open http://localhost:8080 in your browser.

**Note:** The dashboard requires a web server due to CORS restrictions. Simply opening `docs/index.html` directly will not work.

## Автоматизация (cron)

```bash
# Ежедневно в 2:00
0 2 * * * cd /path/to/analytics-repo && node dist/cli.js --repo /path/to/source-repo --old src/legacy --new src/new --output ./docs/progress.json
```

## Структура проекта

```
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── git/                # Git-анализ
│   ├── analysis/           # Подсчёт строк
│   ├── data/               # Схемы и валидация
│   └── git-ops/            # Автокоммит
├── docs/
│   ├── index.html          # Dashboard
│   ├── chart.js            # Charts
│   └── progress.json       # Данные (генерируется)
└── dist/                   # Compiled JS
```

## License

MIT
