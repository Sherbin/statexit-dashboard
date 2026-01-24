import { execSync } from 'child_process';

import { CommitInfo } from '../data/schema.js';
import * as logger from '../logger.js';

/**
 * Находит первый коммит, где появилась указанная папка
 * Использует: git log --reverse --format="%H|%ct" --diff-filter=A -- <path>
 * @returns CommitInfo или null если папка не найдена
 */
export async function findFirstAppearance(repoPath: string, folderPath: string): Promise<CommitInfo | null> {
	try {
		const output = execSync(`git log --reverse --format="%H|%ct" --diff-filter=A -- "${folderPath}"`, {
			cwd: repoPath,
			encoding: 'utf-8',
		});

		const lines = output
			.trim()
			.split('\n')
			.filter((line) => line.length > 0);

		if (lines.length === 0) {
			return null;
		}

		// First line is the first appearance (--reverse)
		const [hash, timestampStr] = lines[0].split('|');

		return {
			hash,
			timestamp: parseInt(timestampStr, 10),
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		logger.error(`Failed to find first appearance of ${folderPath} in ${repoPath}: ${message}`);
		throw err;
	}
}

/**
 * Определяет точку старта миграции — когда ОБЕ папки существуют
 * @returns CommitInfo с более поздней датой появления
 * @throws Error если одна из папок никогда не существовала
 */
export async function findMigrationStart(repoPath: string, oldPath: string, newPath: string): Promise<CommitInfo> {
	const [oldAppearance, newAppearance] = await Promise.all([
		findFirstAppearance(repoPath, oldPath),
		findFirstAppearance(repoPath, newPath),
	]);

	if (!oldAppearance) {
		throw new Error(`Old path "${oldPath}" was never found in repository`);
	}

	if (!newAppearance) {
		throw new Error(`New path "${newPath}" was never found in repository`);
	}

	// Return the later of the two (when BOTH exist)
	return oldAppearance.timestamp >= newAppearance.timestamp ? oldAppearance : newAppearance;
}
