#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { execSync } from 'child_process';

// Импорты из созданных модулей
import { logger, LogLevel } from './logger.js';
import { 
  getCommitHistory, 
  aggregateByDay, 
  getCurrentBranch, 
  checkoutCommit, 
  restoreBranch,
  findMigrationStart 
} from './git/index.js';
import { analyzeFolder } from './analysis/index.js';
import { 
  ProgressData, 
  DataPoint, 
  MetaInfo, 
  DailyCommit 
} from './data/schema.js';
import { 
  validateProgressData, 
  loadExistingData, 
  mergeData, 
  getLastTimestamp, 
  saveData 
} from './data/index.js';
import { commitIfChanged } from './git-ops/index.js';
import {
  getCachePath,
  loadCache,
  saveCache,
  validateCache,
  createCache,
  cacheToCommitInfo,
} from './cache/index.js';

interface ConfigFile {
  repo: string;
  old: string;
  new: string;
  output: string;
  force?: boolean;
  cache?: string;
  logLevel?: LogLevel;
  ignoreOld?: string[];
  ignoreNew?: string[];
}

interface CliOptions {
  repo?: string;
  old?: string;
  new?: string;
  output?: string;
  force: boolean;
  cache?: string;
  logLevel: LogLevel;
  ignoreOld?: string;
  ignoreNew?: string;
  config?: string;
}

function loadConfigFile(configPath: string): ConfigFile {
  const content = fsSync.readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as ConfigFile;
}

async function main(): Promise<void> {
  // 1. Парсинг CLI
  const program = new Command();
  program
    .option('--config <path>', 'Path to config JSON file')
    .option('--repo <path>', 'Path to source repository')
    .option('--old <path>', 'Old folder path (relative to repo)')
    .option('--new <path>', 'New folder path (relative to repo)')
    .option('--output <path>', 'Output JSON file path')
    .option('--force', 'Force full recalculation', false)
    .option('--cache <path>', 'Path to cache file')
    .option('--log-level <level>', 'Log level: debug|info|warn|error', 'info')
    .option('--ignore-old <folders>', 'Comma-separated subfolders to ignore in old path')
    .option('--ignore-new <folders>', 'Comma-separated subfolders to ignore in new path')
    .parse();

  const cliOpts = program.opts<CliOptions>();
  
  // Load config file if specified
  let config: ConfigFile | null = null;
  if (cliOpts.config) {
    config = loadConfigFile(path.resolve(cliOpts.config));
  }
  
  // Merge config with CLI options (CLI takes precedence)
  const repo = cliOpts.repo ?? config?.repo;
  const old = cliOpts.old ?? config?.old;
  const newPath = cliOpts.new ?? config?.new;
  const output = cliOpts.output ?? config?.output;
  
  if (!repo || !old || !newPath || !output) {
    console.error('Error: --repo, --old, --new, and --output are required (via CLI or config file)');
    process.exit(1);
  }
  
  const force = cliOpts.force || config?.force || false;
  const cache = cliOpts.cache ?? config?.cache;
  const logLevel = cliOpts.logLevel ?? config?.logLevel ?? 'info';
  const ignoreOldStr = cliOpts.ignoreOld ?? config?.ignoreOld?.join(',');
  const ignoreNewStr = cliOpts.ignoreNew ?? config?.ignoreNew?.join(',');
  
  // Set log level
  logger.setLevel(logLevel);
  
  // Абсолютные пути
  const repoPath = path.resolve(repo);
  const outputPath = path.resolve(output);
  const oldPath = old;  // относительный путь внутри repo
  const newFolderPath = newPath;  // относительный путь внутри repo
  const cachePath = getCachePath(outputPath, cache);
  const ignoreOld = ignoreOldStr?.split(',').map(s => s.trim()).filter(Boolean);
  const ignoreNew = ignoreNewStr?.split(',').map(s => s.trim()).filter(Boolean);

  logger.info('INIT', 'Starting analysis', {
    repo: repoPath,
    oldPath,
    newPath: newFolderPath,
    output: outputPath,
    cache: cachePath,
    ignoreOld,
    ignoreNew,
    force,
  });

  // 2. Загрузить существующие данные
  let existingData: ProgressData | null = null;
  if (!force) {
    existingData = await loadExistingData(outputPath);
    if (existingData) {
      logger.info('INIT', `Loaded existing data with ${existingData.data.length} points`);
    }
  }

  // 3. Определить точку старта миграции (с кешированием)
  let migrationStart;
  
  if (!force) {
    const cachedData = await loadCache(cachePath);
    if (cachedData && validateCache(cachedData, repoPath, oldPath, newFolderPath)) {
      migrationStart = cacheToCommitInfo(cachedData);
      logger.info('CACHE', `Using cached migration start: ${migrationStart.hash.substring(0, 7)}`);
    }
  }
  
  if (!migrationStart) {
    logger.info('GIT', 'Finding migration start point...');
    migrationStart = await findMigrationStart(repoPath, oldPath, newFolderPath);
    
    // Save to cache
    const cacheData = createCache(migrationStart, oldPath, newFolderPath);
    await saveCache(cachePath, cacheData);
  }
  
  logger.info('GIT', `Migration started at commit ${migrationStart.hash.substring(0, 7)}`);

  // 4. Получить git log
  logger.info('GIT', 'Fetching commit history...');
  const allCommits = await getCommitHistory(repoPath);
  
  // Фильтруем коммиты начиная с точки старта
  const relevantCommits = allCommits.filter(c => c.timestamp >= migrationStart.timestamp);
  logger.info('GIT', `Found ${relevantCommits.length} commits since migration start`);

  // 5. Группируем по дням
  const dailyCommits = aggregateByDay(relevantCommits);
  logger.info('AGGREGATE', `Aggregated to ${dailyCommits.length} daily data points`);

  // 6. Фильтруем уже обработанные
  const lastTimestamp = getLastTimestamp(existingData);
  const newDailyCommits = dailyCommits.filter(dc => {
    // Конвертируем дату в timestamp начала дня UTC
    const dayStart = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;
    return dayStart > lastTimestamp;
  });
  
  if (newDailyCommits.length === 0) {
    logger.info('AGGREGATE', 'No new data points to process');
  } else {
    logger.info('AGGREGATE', `Processing ${newDailyCommits.length} new days...`);
  }

  // 7. Анализ новых коммитов
  const newPoints: DataPoint[] = [];
  
  if (newDailyCommits.length > 0) {
    const originalBranch = await getCurrentBranch(repoPath);
    
    try {
      for (const dc of newDailyCommits) {
        logger.info('CHECKOUT', `Analyzing ${dc.date} (${dc.hash.substring(0, 7)})...`);
        
        await checkoutCommit(repoPath, dc.hash);
        
        const oldFullPath = path.join(repoPath, oldPath);
        const newFullPath = path.join(repoPath, newFolderPath);
        
        const oldStats = await analyzeFolder(oldFullPath, ignoreOld);
        const newStats = await analyzeFolder(newFullPath, ignoreNew);
        
        // Timestamp = начало дня UTC
        const dayTimestamp = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;
        
        const newPoint: DataPoint = {
          time: dayTimestamp,
          oldSizeKB: oldStats.sizeKB,
          newSizeKB: newStats.sizeKB,
          oldFiles: oldStats.files,
          newFiles: newStats.files,
        };
        
        newPoints.push(newPoint);
        
        logger.info('COUNT', `old: ${oldStats.sizeKB} KB, ${oldStats.files} files`);
        logger.info('COUNT', `new: ${newStats.sizeKB} KB, ${newStats.files} files`);
        
        // 🔄 ПРОГРЕССИВНОЕ СОХРАНЕНИЕ: сохраняем после каждого дня
        try {
          // Получаем remote URL для meta
          let sourceRepoUrl: string;
          try {
            sourceRepoUrl = execSync('git remote get-url origin', { 
              cwd: repoPath, 
              encoding: 'utf-8' 
            }).trim();
          } catch {
            sourceRepoUrl = repoPath;
          }

          const progressMeta: MetaInfo = {
            sourceRepo: sourceRepoUrl,
            oldPath: oldPath,
            newPath: newFolderPath,
            generatedAt: new Date().toISOString(),
            version: 2,
            ignoredSubfolders: (ignoreOld || ignoreNew) ? {
              old: ignoreOld,
              new: ignoreNew,
            } : undefined,
          };

          // Объединяем существующие данные с новыми точками
          const progressData = mergeData(existingData, newPoints, progressMeta, false);
          
          // Сохраняем промежуточный результат
          await fs.writeFile(outputPath, JSON.stringify(progressData, null, 2), 'utf-8');
          logger.info('SAVE', `Saved progress: ${newPoints.length} days processed`);
          
          // 🧹 ОЧИСТКА ПАМЯТИ: принудительная сборка мусора после сохранения
          if (global.gc) {
            global.gc();
            logger.debug('GC', 'Manual garbage collection triggered');
          }
        } catch (saveErr) {
          logger.warn('SAVE', `Failed to save progress: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
          // Продолжаем даже если сохранение не удалось
        }
      }
    } finally {
      // 8. Всегда возвращаемся на исходную ветку
      await restoreBranch(repoPath, originalBranch);
      logger.info('CHECKOUT', `Restored to ${originalBranch}`);
    }
  }

  // 9. Получить remote URL для meta
  let sourceRepoUrl: string;
  try {
    sourceRepoUrl = execSync('git remote get-url origin', { 
      cwd: repoPath, 
      encoding: 'utf-8' 
    }).trim();
  } catch {
    sourceRepoUrl = repoPath;  // fallback на путь
  }

  const meta: MetaInfo = {
    sourceRepo: sourceRepoUrl,
    oldPath: oldPath,
    newPath: newFolderPath,
    generatedAt: new Date().toISOString(),
    version: 2,
    ignoredSubfolders: (ignoreOld || ignoreNew) ? {
      old: ignoreOld,
      new: ignoreNew,
    } : undefined,
  };

  // Объединяем данные
  const finalData = mergeData(existingData, newPoints, meta, force);

  // 10. Валидация
  logger.info('VALIDATE', 'Validating data...');
  validateProgressData(finalData);
  logger.info('VALIDATE', 'Validation passed');

  // 11. Записываем файл
  await saveData(outputPath, finalData);
  logger.info('SAVE', `Saved ${finalData.data.length} data points to ${outputPath}`);

  // 12. Коммит и пуш
  const committed = await commitIfChanged(
    outputPath, 
    'Update migration progress data'
  );
  
  if (committed) {
    logger.info('GIT-OPS', 'Changes committed and pushed');
  } else {
    logger.info('GIT-OPS', 'No changes to commit');
  }

  logger.info('DONE', 'Completed successfully');
}

main().catch((err) => {
  logger.error('FATAL', err.message);
  process.exit(1);
});
