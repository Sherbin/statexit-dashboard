#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

interface FileChange {
	file: string;
	additions: number;
	deletions: number;
	total: number;
}

interface CommitAnalysis {
	hash: string;
	timestamp: number;
	date: string;
	message: string;
	author: string;
	fileChanges: FileChange[];
	totalAdditions: number;
	totalDeletions: number;
	filesChanged: number;
}

/**
 * Находит коммит для указанного timestamp из progress.json
 */
function findCommitForTimestamp(repoPath: string, timestamp: number): string {
	try {
		// Конвертируем timestamp в конец дня UTC
		const endOfDay = timestamp + 86400 - 1; // +23:59:59

		// Находим последний коммит до конца этого дня
		const output = execSync(`git log --before=${endOfDay} --format="%H" -1`, {
			cwd: repoPath,
			encoding: 'utf-8',
		});

		return output.trim();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		throw new Error(`Failed to find commit for timestamp ${timestamp}: ${message}`);
	}
}

/**
 * Получает информацию о коммите
 */
function getCommitInfo(
	repoPath: string,
	hash: string,
): Pick<CommitAnalysis, 'hash' | 'timestamp' | 'date' | 'message' | 'author'> {
	try {
		const output = execSync(`git show --no-patch --format="%H|%ct|%cI|%s|%an" ${hash}`, {
			cwd: repoPath,
			encoding: 'utf-8',
		});

		const [fullHash, timestampStr, isoDate, message, author] = output.trim().split('|');

		return {
			hash: fullHash,
			timestamp: parseInt(timestampStr, 10),
			date: isoDate,
			message,
			author,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		throw new Error(`Failed to get commit info for ${hash}: ${message}`);
	}
}

/**
 * Анализирует изменения файлов в коммите
 */
function analyzeFileChanges(repoPath: string, hash: string, oldPath: string): FileChange[] {
	try {
		// Используем --numstat для получения точных чисел изменений
		const output = execSync(`git show --numstat --format="" ${hash} -- ${oldPath}`, {
			cwd: repoPath,
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024,
		});

		const lines = output
			.trim()
			.split('\n')
			.filter((line) => line.length > 0);
		const changes: FileChange[] = [];

		for (const line of lines) {
			// Format: additions \t deletions \t filename
			const parts = line.split('\t');

			if (parts.length < 3) {
				continue;
			}

			const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
			const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
			const file = parts[2];

			changes.push({
				file,
				additions,
				deletions,
				total: additions + deletions,
			});
		}

		// Сортируем по общему числу изменений (убывание)
		return changes.sort((a, b) => b.total - a.total);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		throw new Error(`Failed to analyze file changes for ${hash}: ${message}`);
	}
}

/**
 * Получает статистику изменений всего коммита
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _getCommitStats(repoPath: string, hash: string): string {
	try {
		const output = execSync(`git show --stat ${hash}`, {
			cwd: repoPath,
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024,
		});

		return output;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		throw new Error(`Failed to get commit stats for ${hash}: ${message}`);
	}
}

/**
 * Анализирует spike для указанного timestamp
 */
function analyzeSpike(repoPath: string, oldPath: string, timestamp: number, topN: number = 20): CommitAnalysis {
	console.log(`\n${'='.repeat(80)}`);
	console.log(`📊 Analyzing spike for timestamp: ${timestamp}`);
	console.log(`📅 Date: ${new Date(timestamp * 1000).toISOString()}`);
	console.log(`${'='.repeat(80)}\n`);

	// 1. Находим коммит
	const hash = findCommitForTimestamp(repoPath, timestamp);

	console.log(`🔍 Found commit: ${hash.substring(0, 10)}...\n`);

	// 2. Получаем информацию о коммите
	const info = getCommitInfo(repoPath, hash);

	console.log(`📝 Commit Details:`);
	console.log(`   Hash:      ${info.hash}`);
	console.log(`   Timestamp: ${info.timestamp}`);
	console.log(`   Date:      ${info.date}`);
	console.log(`   Author:    ${info.author}`);
	console.log(`   Message:   ${info.message}`);
	console.log('');

	// 3. Анализируем изменения файлов в oldPath
	console.log(`📁 Analyzing changes in "${oldPath}"...\n`);
	const fileChanges = analyzeFileChanges(repoPath, hash, oldPath);

	const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
	const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);

	console.log(`📈 Summary:`);
	console.log(`   Files changed:    ${fileChanges.length}`);
	console.log(`   Total additions:  ${totalAdditions.toLocaleString()} lines`);
	console.log(`   Total deletions:  ${totalDeletions.toLocaleString()} lines`);
	console.log(`   Net change:       ${(totalAdditions - totalDeletions).toLocaleString()} lines`);
	console.log('');

	// 4. Показываем топ файлов
	console.log(`📋 Top ${topN} files by total changes:\n`);
	console.log(
		`${'#'.padStart(4)} ${'File'.padEnd(60)} ${'Add'.padStart(8)} ${'Del'.padStart(8)} ${'Total'.padStart(10)}`,
	);
	console.log(`${'-'.repeat(4)} ${'-'.repeat(60)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);

	fileChanges.slice(0, topN).forEach((change, idx) => {
		const num = `${idx + 1}.`.padStart(4);
		const file = change.file.length > 60 ? '...' + change.file.slice(-57) : change.file.padEnd(60);
		const add = change.additions.toLocaleString().padStart(8);
		const del = change.deletions.toLocaleString().padStart(8);
		const total = change.total.toLocaleString().padStart(10);

		console.log(`${num} ${file} ${add} ${del} ${total}`);
	});

	console.log('');

	return {
		...info,
		fileChanges,
		totalAdditions,
		totalDeletions,
		filesChanged: fileChanges.length,
	};
}

/**
 * Загружает конфигурацию
 */
function loadConfig(): { repo: string; old: string } {
	const configPath = path.join(__dirname, '..', 'config.json');
	const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

	if (!config.repo || !config.old) {
		throw new Error('config.json must contain "repo" and "old" fields');
	}

	return {
		repo: config.repo,
		old: config.old,
	};
}

/**
 * Main
 */
function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log('Usage: node dist/analyze-spike.js <timestamp1> [timestamp2] ...');
		console.log('');
		console.log('Example:');
		console.log('  node dist/analyze-spike.js 1754179200 1765065600');
		console.log('');
		console.log('Known suspicious dates:');
		console.log('  - August 3, 2025:    1754179200');
		console.log('  - December 7, 2025:  1765065600');
		process.exit(1);
	}

	const config = loadConfig();
	const timestamps = args.map((arg) => parseInt(arg, 10));

	console.log(`\n🔧 Configuration:`);
	console.log(`   Repository: ${config.repo}`);
	console.log(`   Old path:   ${config.old}`);
	console.log('');

	const results: CommitAnalysis[] = [];

	for (const timestamp of timestamps) {
		try {
			const analysis = analyzeSpike(config.repo, config.old, timestamp);

			results.push(analysis);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);

			console.error(`❌ Error analyzing timestamp ${timestamp}: ${message}`);
		}
	}

	// Финальная сводка
	if (results.length > 1) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`📊 FINAL SUMMARY (${results.length} spikes analyzed)`);
		console.log(`${'='.repeat(80)}\n`);

		results.forEach((result, idx) => {
			console.log(`${idx + 1}. ${new Date(result.timestamp * 1000).toISOString()}`);
			console.log(`   Commit:  ${result.hash.substring(0, 10)}...`);
			console.log(`   Files:   ${result.filesChanged}`);
			console.log(
				`   Changes: +${result.totalAdditions.toLocaleString()} / -${result.totalDeletions.toLocaleString()}`,
			);
			console.log(`   Message: ${result.message}`);
			console.log('');
		});
	}
}

main();
