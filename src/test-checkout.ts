#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки механизма git checkout
 * Переключается между несколькими коммитами и проверяет чистоту состояния
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface TestResult {
  hash: string;
  success: boolean;
  error?: string;
  untrackedFiles?: number;
  stagedChanges?: number;
}

async function removeIndexLock(repoPath: string): Promise<void> {
  const indexLockPath = path.join(repoPath, '.git', 'index.lock');
  try {
    await fs.unlink(indexLockPath);
    console.log('✓ Removed stale index.lock');
  } catch {
    // File doesn't exist, ignore
  }
}

function getUntrackedCount(repoPath: string): number {
  try {
    const output = execSync('git ls-files --others --exclude-standard', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim().split('\n').filter(line => line.length > 0).length;
  } catch {
    return -1;
  }
}

function getStagedCount(repoPath: string): number {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim().split('\n').filter(line => line.length > 0).length;
  } catch {
    return -1;
  }
}

async function testCheckout(repoPath: string, hash: string): Promise<TestResult> {
  const result: TestResult = {
    hash: hash.substring(0, 7),
    success: false,
  };

  try {
    console.log(`\n→ Testing checkout to ${result.hash}...`);

    // Remove index.lock if exists
    await removeIndexLock(repoPath);

    // Reset with timeout
    execSync('git reset --hard HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('  ✓ Reset hard');

    // Clean with timeout and -fdx
    const cleanOutput = execSync('git clean -fdx', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
    });
    if (cleanOutput.trim()) {
      console.log(`  ✓ Cleaned: ${cleanOutput.trim().split('\n').length} items`);
    } else {
      console.log('  ✓ Clean (no files to remove)');
    }

    // Checkout with timeout
    execSync(`git checkout --force --quiet ${hash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000, // 60 seconds max
    });
    console.log('  ✓ Checkout successful');

    // Verify clean state
    result.untrackedFiles = getUntrackedCount(repoPath);
    result.stagedChanges = getStagedCount(repoPath);

    console.log(`  ✓ State: ${result.untrackedFiles} untracked, ${result.stagedChanges} staged`);

    if (result.untrackedFiles === 0 && result.stagedChanges === 0) {
      result.success = true;
      console.log('  ✅ Clean state verified');
    } else {
      result.success = false;
      result.error = `Dirty state: ${result.untrackedFiles} untracked, ${result.stagedChanges} staged`;
      console.log(`  ⚠️  ${result.error}`);
    }
  } catch (err) {
    result.success = false;
    result.error = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Failed: ${result.error}`);
  }

  return result;
}

async function main() {
  const repoPath = process.argv[2];
  const commitsArg = process.argv[3];

  if (!repoPath || !commitsArg) {
    console.error('Usage: node test-checkout.js <repo-path> <commit1,commit2,...>');
    console.error('Example: node test-checkout.js /path/to/repo abc123,def456,ghi789');
    process.exit(1);
  }

  const commits = commitsArg.split(',').map(h => h.trim());

  console.log('='.repeat(60));
  console.log('Git Checkout Test');
  console.log('='.repeat(60));
  console.log(`Repository: ${repoPath}`);
  console.log(`Commits to test: ${commits.length}`);
  console.log('='.repeat(60));

  const results: TestResult[] = [];

  for (const hash of commits) {
    const result = await testCheckout(repoPath, hash);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed commits:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.hash}: ${r.error}`);
    });
  }

  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
