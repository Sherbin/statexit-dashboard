#!/usr/bin/env node

/**
 * Диагностический скрипт для детального анализа проблемного коммита
 * Замеряет время каждой операции и выводит состояние репозитория
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface StepResult {
	name: string;
	duration: number;
	success: boolean;
	error?: string;
	output?: string;
}

function measureTime<T>(fn: () => T): [T, number] {
	const start = Date.now();
	const result = fn();
	const duration = Date.now() - start;

	return [result, duration];
}

function getGitStatus(repoPath: string): string {
	try {
		return execSync('git status --short', {
			cwd: repoPath,
			encoding: 'utf-8',
			timeout: 5000,
		});
	} catch {
		return 'ERROR';
	}
}

function getFileCount(repoPath: string, type: 'staged' | 'unstaged' | 'untracked'): number {
	try {
		let cmd: string;

		switch (type) {
			case 'staged':
				cmd = 'git diff --cached --name-only';
				break;
			case 'unstaged':
				cmd = 'git diff --name-only';
				break;
			case 'untracked':
				cmd = 'git ls-files --others --exclude-standard';
				break;
		}

		const output = execSync(cmd, {
			cwd: repoPath,
			encoding: 'utf-8',
			timeout: 5000,
		});

		return output
			.trim()
			.split('\n')
			.filter((line) => line.length > 0).length;
	} catch {
		return -1;
	}
}

function printRepoState(repoPath: string, label: string): void {
	console.log(`\n📊 Repository state (${label}):`);
	console.log(`   Staged files:    ${getFileCount(repoPath, 'staged')}`);
	console.log(`   Unstaged files:  ${getFileCount(repoPath, 'unstaged')}`);
	console.log(`   Untracked files: ${getFileCount(repoPath, 'untracked')}`);

	const status = getGitStatus(repoPath);

	if (status && status !== 'ERROR' && status.trim()) {
		const lines = status.trim().split('\n');

		console.log(`   Git status (first 5 lines):`);
		lines.slice(0, 5).forEach((line) => console.log(`     ${line}`));
		if (lines.length > 5) {
			console.log(`     ... and ${lines.length - 5} more`);
		}
	} else if (status === 'ERROR') {
		console.log(`   ⚠️  Git status failed`);
	} else {
		console.log(`   ✓ Clean working directory`);
	}
}

async function removeLockFiles(repoPath: string): Promise<void> {
	const lockFiles = [path.join(repoPath, '.git', 'index.lock'), path.join(repoPath, '.git', 'HEAD.lock')];

	for (const lockFile of lockFiles) {
		try {
			await fs.unlink(lockFile);
			console.log(`   🗑️  Removed: ${path.basename(lockFile)}`);
		} catch {
			// Ignore
		}
	}
}

function killGitProcesses(repoPath: string): void {
	try {
		const result = spawnSync('pgrep', ['-f', `git.*${path.basename(repoPath)}`], {
			encoding: 'utf-8',
		});

		if (result.stdout && result.stdout.trim()) {
			const pids = result.stdout.trim().split('\n');

			console.log(`   ⚠️  Found ${pids.length} git processes`);
			pids.forEach((pid) => {
				try {
					process.kill(parseInt(pid, 10), 'SIGKILL');
					console.log(`   💀 Killed process: ${pid}`);
				} catch {
					// Already dead
				}
			});
		} else {
			console.log(`   ✓ No stale git processes`);
		}
	} catch {
		console.log(`   ✓ No stale git processes (pgrep failed)`);
	}
}

async function diagnoseCheckout(repoPath: string, targetHash: string): Promise<void> {
	console.log('='.repeat(70));
	console.log('Git Checkout Diagnostics');
	console.log('='.repeat(70));
	console.log(`Repository: ${repoPath}`);
	console.log(`Target commit: ${targetHash.substring(0, 7)}`);
	console.log('='.repeat(70));

	const steps: StepResult[] = [];

	// Initial state
	printRepoState(repoPath, 'INITIAL');

	// Step 1: Kill stale processes
	console.log('\n🔧 Step 1: Kill stale git processes');
	const [, killDuration] = measureTime(() => killGitProcesses(repoPath));

	steps.push({ name: 'Kill processes', duration: killDuration, success: true });

	// Step 2: Remove lock files
	console.log('\n🔧 Step 2: Remove lock files');
	const [, lockDuration] = measureTime(() => removeLockFiles(repoPath));

	steps.push({ name: 'Remove locks', duration: lockDuration, success: true });

	printRepoState(repoPath, 'AFTER CLEANUP');

	// Step 3: git reset --hard HEAD
	console.log('\n🔧 Step 3: git reset --hard HEAD');
	try {
		const [output, resetDuration] = measureTime(() => {
			return execSync('git reset --hard HEAD', {
				cwd: repoPath,
				encoding: 'utf-8',
				timeout: 60000,
			});
		});

		console.log(`   ✅ Completed in ${resetDuration}ms`);
		steps.push({ name: 'git reset --hard', duration: resetDuration, success: true, output });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);

		console.log(`   ❌ Failed: ${error}`);
		steps.push({ name: 'git reset --hard', duration: 0, success: false, error });

		return; // Stop here
	}

	printRepoState(repoPath, 'AFTER RESET');

	// Step 4: git clean -fdx
	console.log('\n🔧 Step 4: git clean -fdx');
	try {
		const [output, cleanDuration] = measureTime(() => {
			return execSync('git clean -fdx', {
				cwd: repoPath,
				encoding: 'utf-8',
				timeout: 120000, // 2 minutes
			});
		});
		const cleanedCount = output
			.trim()
			.split('\n')
			.filter((line) => line.startsWith('Removing')).length;

		console.log(`   ✅ Completed in ${cleanDuration}ms`);
		console.log(`   📁 Removed ${cleanedCount} items`);
		steps.push({ name: 'git clean -fdx', duration: cleanDuration, success: true, output });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);

		console.log(`   ❌ Failed: ${error}`);
		steps.push({ name: 'git clean -fdx', duration: 0, success: false, error });

		return; // Stop here
	}

	printRepoState(repoPath, 'AFTER CLEAN');

	// Step 5: git checkout --force
	console.log('\n🔧 Step 5: git checkout --force --no-recurse-submodules <hash>');
	try {
		const [output, checkoutDuration] = measureTime(() => {
			return execSync(`git checkout --force --quiet --no-recurse-submodules ${targetHash}`, {
				cwd: repoPath,
				encoding: 'utf-8',
				timeout: 120000, // 2 minutes
			});
		});

		console.log(`   ✅ Completed in ${checkoutDuration}ms`);
		steps.push({ name: 'git checkout', duration: checkoutDuration, success: true, output });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);

		console.log(`   ❌ Failed: ${error}`);
		steps.push({ name: 'git checkout', duration: 0, success: false, error });

		return; // Stop here
	}

	printRepoState(repoPath, 'AFTER CHECKOUT');

	// Summary
	console.log('\n' + '='.repeat(70));
	console.log('SUMMARY');
	console.log('='.repeat(70));

	steps.forEach((step) => {
		const status = step.success ? '✅' : '❌';

		console.log(`${status} ${step.name.padEnd(20)} ${step.duration.toString().padStart(6)}ms`);
		if (step.error) {
			console.log(`   Error: ${step.error}`);
		}
	});

	const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

	console.log(`\n⏱️  Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);

	const slowestStep = steps.reduce((max, step) => (step.duration > max.duration ? step : max));

	console.log(`🐌 Slowest step: ${slowestStep.name} (${slowestStep.duration}ms)`);

	console.log('='.repeat(70));
}

async function main() {
	const repoPath = process.argv[2];
	const targetHash = process.argv[3];

	if (!repoPath || !targetHash) {
		console.error('Usage: node diagnose-checkout.js <repo-path> <commit-hash>');
		console.error('Example: node diagnose-checkout.js /path/to/repo 0a6e435');
		process.exit(1);
	}

	await diagnoseCheckout(repoPath, targetHash);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
