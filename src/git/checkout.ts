import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as logger from '../logger.js';

/**
 * Принудительно убивает все git процессы в репозитории
 */
function killGitProcesses(repoPath: string): void {
  try {
    // Find git processes for this repository
    const result = spawnSync('pgrep', ['-f', `git.*${path.basename(repoPath)}`], {
      encoding: 'utf-8',
    });
    
    if (result.stdout) {
      const pids = result.stdout.trim().split('\n').filter(pid => pid);
      pids.forEach(pid => {
        try {
          process.kill(parseInt(pid, 10), 'SIGKILL');
          logger.warn(`Killed stale git process: ${pid}`);
        } catch {
          // Process already dead
        }
      });
    }
  } catch {
    // pgrep not available or no processes found
  }
}

/**
 * Удаляет все lock файлы git
 */
async function removeLockFiles(repoPath: string): Promise<void> {
  const lockFiles = [
    path.join(repoPath, '.git', 'index.lock'),
    path.join(repoPath, '.git', 'HEAD.lock'),
    path.join(repoPath, '.git', 'refs', 'heads', 'master.lock'),
    path.join(repoPath, '.git', 'refs', 'heads', 'main.lock'),
  ];

  for (const lockFile of lockFiles) {
    try {
      await fs.unlink(lockFile);
      logger.warn(`Removed stale lock: ${path.basename(lockFile)}`);
    } catch {
      // File doesn't exist, ignore
    }
  }
}

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
 * Делает checkout на указанный коммит (полный сброс)
 * 1. Убивает зависшие git процессы
 * 2. Удаляет lock файлы
 * 3. Сбрасывает все изменения
 * 4. Удаляет untracked и ignored файлы
 * 5. Переключается на коммит
 */
export async function checkoutCommit(repoPath: string, hash: string): Promise<void> {
  try {
    // Kill any stale git processes
    killGitProcesses(repoPath);
    
    // Remove all lock files
    await removeLockFiles(repoPath);
    
    // Reset any staged changes
    execSync('git reset --hard HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 30000, // 30 seconds max
    });
    
    // Remove untracked and ignored files (-x flag)
    execSync('git clean -fdx', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000, // 60 seconds max
    });
    
    // Checkout to target commit (skip LFS smudge to avoid hanging)
    execSync(`git checkout --force --quiet --no-recurse-submodules ${hash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
    });
    
    logger.log(`Checked out to ${hash.substring(0, 7)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to checkout commit ${hash} in ${repoPath}: ${message}`);
    
    // Try to recover by killing processes and removing locks
    killGitProcesses(repoPath);
    await removeLockFiles(repoPath);
    
    throw err;
  }
}

/**
 * Возвращается на исходную ветку (полный сброс)
 */
export async function restoreBranch(repoPath: string, branch: string): Promise<void> {
  try {
    // Kill any stale git processes
    killGitProcesses(repoPath);
    
    // Remove lock files
    await removeLockFiles(repoPath);
    
    // Reset any staged changes
    execSync('git reset --hard HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 30000,
    });
    
    // Remove untracked and ignored files (-x flag)
    execSync('git clean -fdx', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
    });
    
    // Checkout to target branch (skip LFS smudge)
    execSync(`git checkout --force --quiet --no-recurse-submodules ${branch}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
    });
    
    logger.log(`Restored to ${branch}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to restore branch ${branch} in ${repoPath}: ${message}`);
    throw err;
  }
}
