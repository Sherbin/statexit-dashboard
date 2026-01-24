import { execSync } from 'child_process';
import { CommitInfo } from '../data/schema.js';
import * as logger from '../logger.js';

/**
 * Получает список всех коммитов из репозитория
 * Использует: git log --reverse --format="%H|%ct"
 * @returns массив коммитов с hash и timestamp
 */
export async function getCommitHistory(repoPath: string): Promise<CommitInfo[]> {
  try {
    const output = execSync('git log --reverse --format="%H|%ct"', {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB for large repos
    });

    const lines = output.trim().split('\n').filter(line => line.length > 0);
    
    return lines.map(line => {
      const [hash, timestampStr] = line.split('|');
      return {
        hash,
        timestamp: parseInt(timestampStr, 10),
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to get commit history from ${repoPath}: ${message}`);
    throw err;
  }
}
