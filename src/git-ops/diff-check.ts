import { execSync } from 'child_process';
import * as path from 'path';

import * as logger from '../logger.js';

/**
 * Проверяет, изменился ли файл относительно последнего коммита
 * Использует: git diff --quiet <filePath>
 *
 * @returns true если файл изменён, false если нет изменений
 */
export async function hasFileChanged(filePath: string): Promise<boolean> {
	const repoPath = path.dirname(filePath);
	const fileName = path.basename(filePath);

	try {
		execSync(`git diff --quiet "${fileName}"`, {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		// Exit code 0 = no changes
		return false;
	} catch (err: unknown) {
		// Exit code 1 = changes detected
		if (err && typeof err === 'object' && 'status' in err && err.status === 1) {
			return true;
		}
		// Other error
		const message = err instanceof Error ? err.message : String(err);

		logger.error(`Failed to check diff for ${filePath}: ${message}`);
		throw new Error(`Git diff failed for ${filePath}: ${message}`);
	}
}

/**
 * Проверяет, есть ли незакоммиченные изменения в репозитории
 */
export async function hasUncommittedChanges(repoPath: string): Promise<boolean> {
	try {
		execSync('git diff --quiet HEAD', {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		// Exit code 0 = no changes
		return false;
	} catch (err: unknown) {
		// Exit code 1 = changes detected
		if (err && typeof err === 'object' && 'status' in err && err.status === 1) {
			return true;
		}
		// Other error
		const message = err instanceof Error ? err.message : String(err);

		logger.error(`Failed to check uncommitted changes in ${repoPath}: ${message}`);
		throw new Error(`Git diff failed in ${repoPath}: ${message}`);
	}
}
