import { execSync } from 'child_process';
import * as path from 'path';

import * as logger from '../logger.js';

import { hasFileChanged } from './diff-check.js';

/**
 * Добавляет файл в индекс, коммитит и пушит
 *
 * @param filePath - путь к файлу (относительно репо или абсолютный)
 * @param message - сообщение коммита
 * @throws Error при ошибке git
 */
export async function commitAndPush(filePath: string, message: string): Promise<void> {
	const repoPath = path.dirname(filePath);
	const fileName = path.basename(filePath);

	try {
		logger.log(`Adding ${fileName} to git index...`);
		execSync(`git add "${fileName}"`, {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		logger.log(`Committing with message: ${message}`);
		execSync(`git commit --quiet -m "${message.replace(/"/g, '\\"')}"`, {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		logger.log('Pushing to remote...');
		execSync('git push --quiet', {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		logger.log('Successfully committed and pushed');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		logger.error(`Git operation failed: ${message}`);
		throw new Error(`Git commit/push failed for ${filePath}: ${message}`);
	}
}

/**
 * Идемпотентный коммит: проверяет изменения, коммитит только если нужно
 *
 * @returns true если был сделан коммит, false если изменений не было
 */
export async function commitIfChanged(filePath: string, message: string): Promise<boolean> {
	const changed = await hasFileChanged(filePath);

	if (!changed) {
		logger.log(`No changes in ${filePath}, skipping commit`);

		return false;
	}

	await commitAndPush(filePath, message);

	return true;
}
