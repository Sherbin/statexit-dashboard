#!/usr/bin/env node

/**
 * Тестирует переключение на все дневные коммиты с начала миграции до сегодня
 * Использует ту же логику агрегации что и основной скрипт
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import { loadCache } from './cache/cache-manager.js';
import { aggregateByDay } from './git/aggregate.js';
import { getCommitHistory } from './git/history.js';

interface TestResult {
	date: string;
	hash: string;
	success: boolean;
	duration: number;
	error?: string;
}

async function removeIndexLock(repoPath: string): Promise<void> {
	const lockFiles = [path.join(repoPath, '.git', 'index.lock'), path.join(repoPath, '.git', 'HEAD.lock')];

	for (const lockFile of lockFiles) {
		try {
			await fs.unlink(lockFile);
			console.log(`    ⚠️  Removed stale lock: ${path.basename(lockFile)}`);
		} catch {
			// Ignore
		}
	}
}

function killGitProcesses(repoPath: string): void {
	try {
		const result = execSync(`pgrep -f "git.*${path.basename(repoPath)}"`, {
			encoding: 'utf-8',
			stdio: 'pipe',
		});

		if (result.trim()) {
			const pids = result.trim().split('\n');

			pids.forEach((pid) => {
				try {
					process.kill(parseInt(pid, 10), 'SIGKILL');
					console.log(`    ⚠️  Killed stale git process: ${pid}`);
				} catch {
					// Already dead
				}
			});
		}
	} catch {
		// No processes found or pgrep failed
	}
}

async function testCheckout(repoPath: string, hash: string, date: string): Promise<TestResult> {
	const startTime = Date.now();
	const result: TestResult = {
		date,
		hash: hash.substring(0, 7),
		success: false,
		duration: 0,
	};

	try {
		// Kill stale processes and remove locks
		killGitProcesses(repoPath);
		await removeIndexLock(repoPath);

		// Reset
		execSync('git reset --hard HEAD', {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
			timeout: 30000,
		});

		// Clean with -fdx
		execSync('git clean -fdx', {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
			timeout: 60000,
		});

		// Checkout (skip LFS smudge, skip submodules)
		execSync(`git checkout --force --quiet --no-recurse-submodules ${hash}`, {
			cwd: repoPath,
			encoding: 'utf-8',
			stdio: 'pipe',
			timeout: 60000,
			env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
		});

		result.success = true;
		result.duration = Date.now() - startTime;
	} catch (err) {
		result.success = false;
		result.duration = Date.now() - startTime;
		result.error = err instanceof Error ? err.message : String(err);
	}

	return result;
}

async function main() {
	const repoPath = process.argv[2];
	const cachePath = process.argv[3];
	const pauseMs = parseInt(process.argv[4] || '1500', 10);

	if (!repoPath || !cachePath) {
		console.error('Usage: node test-all-daily-commits.js <repo-path> <cache-path> [pause-ms]');
		console.error('Example: node test-all-daily-commits.js /path/to/repo /path/to/cache.json 1500');
		process.exit(1);
	}

	console.log('='.repeat(70));
	console.log('Git Daily Commits Checkout Test');
	console.log('='.repeat(70));
	console.log(`Repository: ${repoPath}`);
	console.log(`Cache: ${cachePath}`);
	console.log(`Pause between checkouts: ${pauseMs}ms`);
	console.log('='.repeat(70));

	// Load migration start from cache
	console.log('\n📦 Loading migration start from cache...');
	const cache = await loadCache(cachePath);

	if (!cache) {
		console.error('❌ Failed to load cache. Run analysis first to create cache.');
		process.exit(1);
	}

	console.log(`✓ Migration start: ${cache.migrationStartHash.substring(0, 7)}`);
	console.log(`✓ Timestamp: ${new Date(cache.migrationStartTimestamp * 1000).toISOString()}`);

	// Get commit history
	console.log('\n📜 Fetching commit history...');
	const allCommits = await getCommitHistory(repoPath);
	const commits = allCommits.filter((c) => c.timestamp >= cache.migrationStartTimestamp);

	console.log(`✓ Found ${commits.length} commits since migration start`);

	// Aggregate by day
	console.log('\n📅 Aggregating to daily commits...');
	const dailyCommits = aggregateByDay(commits);

	console.log(`✓ Aggregated to ${dailyCommits.length} daily data points`);

	// Test each daily commit
	console.log('\n🔄 Testing checkout for each daily commit...\n');

	const results: TestResult[] = [];
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < dailyCommits.length; i++) {
		const commit = dailyCommits[i];
		const date = new Date(commit.timestamp * 1000).toISOString().split('T')[0];
		const progress = `[${i + 1}/${dailyCommits.length}]`;

		process.stdout.write(`${progress} ${date} (${commit.hash.substring(0, 7)})... `);

		const result = await testCheckout(repoPath, commit.hash, date);

		results.push(result);

		if (result.success) {
			successCount++;
			console.log(`✅ ${result.duration}ms`);
		} else {
			failCount++;
			console.log(`❌ ${result.duration}ms`);
			console.log(`    Error: ${result.error}`);
		}

		// Pause between checkouts
		if (i < dailyCommits.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, pauseMs));
		}
	}

	// Summary
	console.log('\n' + '='.repeat(70));
	console.log('SUMMARY');
	console.log('='.repeat(70));
	console.log(`Total days tested: ${results.length}`);
	console.log(`✅ Successful: ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
	console.log(`❌ Failed: ${failCount} (${((failCount / results.length) * 100).toFixed(1)}%)`);

	if (failCount > 0) {
		console.log('\n❌ Failed dates:');
		results
			.filter((r) => !r.success)
			.forEach((r) => {
				console.log(`  - ${r.date} (${r.hash}): ${r.error}`);
			});
	}

	// Performance stats
	const durations = results.filter((r) => r.success).map((r) => r.duration);

	if (durations.length > 0) {
		const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
		const maxDuration = Math.max(...durations);
		const minDuration = Math.min(...durations);

		console.log('\n⏱️  Performance:');
		console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
		console.log(`  Min: ${minDuration}ms`);
		console.log(`  Max: ${maxDuration}ms`);
		console.log(`  Total time: ${(durations.reduce((a, b) => a + b, 0) / 1000 / 60).toFixed(1)} minutes`);
	}

	console.log('='.repeat(70));

	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
