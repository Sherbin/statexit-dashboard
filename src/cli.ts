#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { execSync } from 'child_process';

// Импорты из созданных модулей
import { log, error } from './logger.js';
import { 
  getCommitHistory, 
  aggregateByDay, 
  getCurrentBranch, 
  checkoutCommit, 
  restoreBranch,
  findMigrationStart 
} from './git/index.js';
import { countLines } from './analysis/index.js';
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

interface CliOptions {
  repo: string;
  old: string;
  new: string;
  output: string;
  force: boolean;
}

async function main(): Promise<void> {
  // 1. Парсинг CLI
  const program = new Command();
  program
    .requiredOption('--repo <path>', 'Path to source repository')
    .requiredOption('--old <path>', 'Old folder path (relative to repo)')
    .requiredOption('--new <path>', 'New folder path (relative to repo)')
    .requiredOption('--output <path>', 'Output JSON file path')
    .option('--force', 'Force full recalculation', false)
    .parse();

  const opts = program.opts<CliOptions>();
  
  // Абсолютные пути
  const repoPath = path.resolve(opts.repo);
  const outputPath = path.resolve(opts.output);
  const oldPath = opts.old;  // относительный путь внутри repo
  const newPath = opts.new;  // относительный путь внутри repo

  log(`Source repo: ${repoPath}`);
  log(`Old path: ${oldPath}`);
  log(`New path: ${newPath}`);
  log(`Output: ${outputPath}`);
  log(`Force: ${opts.force}`);

  // 2. Загрузить существующие данные
  let existingData: ProgressData | null = null;
  if (!opts.force) {
    existingData = await loadExistingData(outputPath);
    if (existingData) {
      log(`Loaded existing data with ${existingData.data.length} points`);
    }
  }

  // 3. Определить точку старта миграции
  log('Finding migration start point...');
  const migrationStart = await findMigrationStart(repoPath, oldPath, newPath);
  log(`Migration started at commit ${migrationStart.hash.substring(0, 7)}`);

  // 4. Получить git log
  log('Fetching commit history...');
  const allCommits = await getCommitHistory(repoPath);
  
  // Фильтруем коммиты начиная с точки старта
  const relevantCommits = allCommits.filter(c => c.timestamp >= migrationStart.timestamp);
  log(`Found ${relevantCommits.length} commits since migration start`);

  // 5. Группируем по дням
  const dailyCommits = aggregateByDay(relevantCommits);
  log(`Aggregated to ${dailyCommits.length} daily data points`);

  // 6. Фильтруем уже обработанные
  const lastTimestamp = getLastTimestamp(existingData);
  const newDailyCommits = dailyCommits.filter(dc => {
    // Конвертируем дату в timestamp начала дня UTC
    const dayStart = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;
    return dayStart > lastTimestamp;
  });
  
  if (newDailyCommits.length === 0) {
    log('No new data points to process');
  } else {
    log(`Processing ${newDailyCommits.length} new days...`);
  }

  // 7. Анализ новых коммитов
  const newPoints: DataPoint[] = [];
  
  if (newDailyCommits.length > 0) {
    const originalBranch = await getCurrentBranch(repoPath);
    
    try {
      for (const dc of newDailyCommits) {
        log(`Analyzing ${dc.date} (${dc.hash.substring(0, 7)})...`);
        
        await checkoutCommit(repoPath, dc.hash);
        
        const oldFullPath = path.join(repoPath, oldPath);
        const newFullPath = path.join(repoPath, newPath);
        
        const oldLines = await countLines(oldFullPath);
        const newLines = await countLines(newFullPath);
        
        // Timestamp = начало дня UTC
        const dayTimestamp = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;
        
        newPoints.push({
          time: dayTimestamp,
          old: oldLines,
          new: newLines
        });
        
        log(`  old: ${oldLines}, new: ${newLines}`);
      }
    } finally {
      // 8. Всегда возвращаемся на исходную ветку
      await restoreBranch(repoPath, originalBranch);
      log(`Restored to ${originalBranch}`);
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
    newPath: newPath,
    generatedAt: new Date().toISOString()
  };

  // Объединяем данные
  const finalData = mergeData(existingData, newPoints, meta, opts.force);

  // 10. Валидация
  log('Validating data...');
  validateProgressData(finalData);
  log('Validation passed');

  // 11. Записываем файл
  await saveData(outputPath, finalData);
  log(`Saved ${finalData.data.length} data points to ${outputPath}`);

  // 12. Коммит и пуш
  const committed = await commitIfChanged(
    outputPath, 
    'Update migration progress data'
  );
  
  if (committed) {
    log('Changes committed and pushed');
  } else {
    log('No changes to commit');
  }

  log('Done!');
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
