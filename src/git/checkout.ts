import { execSync } from 'child_process';
import * as logger from '../logger.js';

/**
 * Получает текущую ветку или HEAD
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    // Try to get branch name first
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    // If detached HEAD, return the commit hash
    if (branch === 'HEAD') {
      return execSync('git rev-parse HEAD', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
    }

    return branch;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to get current branch in ${repoPath}: ${message}`);
    throw err;
  }
}

/**
 * Делает checkout на указанный коммит
 */
export async function checkoutCommit(repoPath: string, hash: string): Promise<void> {
  try {
    execSync(`git checkout --quiet ${hash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to checkout commit ${hash} in ${repoPath}: ${message}`);
    throw err;
  }
}

/**
 * Возвращается на исходную ветку
 */
export async function restoreBranch(repoPath: string, branch: string): Promise<void> {
  try {
    execSync(`git checkout --quiet ${branch}`, {
      cwd: repoPath,
      encoding: 'utf-8',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to restore branch ${branch} in ${repoPath}: ${message}`);
    throw err;
  }
}
