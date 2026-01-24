import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { CacheData, CACHE_VERSION } from './cache-schema.js';
import { CommitInfo } from '../data/schema.js';
import { logger } from '../logger.js';

const DEFAULT_CACHE_FILENAME = '.migration-cache.json';

/**
 * Получает путь к файлу кеша
 */
export function getCachePath(outputPath: string, customCachePath?: string): string {
  if (customCachePath) {
    return path.resolve(customCachePath);
  }
  const dir = path.dirname(path.resolve(outputPath));
  return path.join(dir, DEFAULT_CACHE_FILENAME);
}

/**
 * Проверяет существование коммита в репозитории
 */
export function commitExists(repoPath: string, hash: string): boolean {
  try {
    execSync(`git cat-file -t ${hash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Загружает кеш из файла
 */
export async function loadCache(cachePath: string): Promise<CacheData | null> {
  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    const data = JSON.parse(content) as CacheData;
    
    // Validate version
    if (data.version !== CACHE_VERSION) {
      logger.warn('CACHE', `Cache version mismatch: expected ${CACHE_VERSION}, got ${data.version}`);
      return null;
    }
    
    return data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.warn('CACHE', `Failed to read cache: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Сохраняет кеш в файл
 */
export async function saveCache(cachePath: string, data: CacheData): Promise<void> {
  try {
    const dir = path.dirname(cachePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('CACHE', `Saved cache to ${cachePath}`);
  } catch (err) {
    logger.warn('CACHE', `Failed to save cache: ${(err as Error).message}`);
    // Don't throw - cache is optional
  }
}

/**
 * Валидирует кеш против текущих параметров
 */
export function validateCache(
  cache: CacheData,
  repoPath: string,
  oldPath: string,
  newPath: string
): boolean {
  // Check paths match
  if (cache.oldPath !== oldPath || cache.newPath !== newPath) {
    logger.warn('CACHE', 'Cache paths do not match current parameters');
    return false;
  }
  
  // Check commit still exists
  if (!commitExists(repoPath, cache.migrationStartHash)) {
    logger.warn('CACHE', `Cached commit ${cache.migrationStartHash} no longer exists (history rewritten?)`);
    return false;
  }
  
  return true;
}

/**
 * Создает новый кеш из CommitInfo
 */
export function createCache(
  migrationStart: CommitInfo,
  oldPath: string,
  newPath: string
): CacheData {
  return {
    version: CACHE_VERSION,
    migrationStartHash: migrationStart.hash,
    migrationStartTimestamp: migrationStart.timestamp,
    oldPath,
    newPath,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Конвертирует CacheData в CommitInfo
 */
export function cacheToCommitInfo(cache: CacheData): CommitInfo {
  return {
    hash: cache.migrationStartHash,
    timestamp: cache.migrationStartTimestamp,
  };
}
