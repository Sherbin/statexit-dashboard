import { CommitInfo, DailyCommit } from '../data/schema.js';

/**
 * Группирует коммиты по дням (UTC) и выбирает последний коммит каждого дня
 * @returns массив DailyCommit, отсортированный по дате
 */
export function aggregateByDay(commits: CommitInfo[]): DailyCommit[] {
	const dailyMap = new Map<string, CommitInfo>();

	for (const commit of commits) {
		// Convert timestamp to UTC date string YYYY-MM-DD
		const date = new Date(commit.timestamp * 1000);
		const dateStr = date.toISOString().split('T')[0];

		const existing = dailyMap.get(dateStr);

		// Keep commit with maximum timestamp for each day
		if (!existing || commit.timestamp > existing.timestamp) {
			dailyMap.set(dateStr, commit);
		}
	}

	// Convert to DailyCommit array and sort by date
	const result: DailyCommit[] = [];

	for (const [date, commit] of dailyMap.entries()) {
		result.push({
			date,
			hash: commit.hash,
			timestamp: commit.timestamp,
		});
	}

	return result.sort((a, b) => a.date.localeCompare(b.date));
}
