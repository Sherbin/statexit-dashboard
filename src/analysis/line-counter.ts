import * as fs from 'fs/promises';
import * as path from 'path';
import { FolderStats } from '../data/schema.js';

/**
 * Список папок для игнорирования
 */
export const IGNORED_DIRS: Set<string> = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.DS_Store',
]);

/**
 * Рекурсивно анализирует папку: считает размер и количество файлов
 * БЕЗ чтения содержимого файлов - только fs.stat()
 * 
 * @param folderPath - абсолютный путь к папке
 * @param ignoredSubfolders - список подпапок для игнорирования
 * @returns статистика: размер в KB и количество файлов
 */
export async function analyzeFolder(
  folderPath: string,
  ignoredSubfolders?: string[]
): Promise<FolderStats> {
  const ignoredSet = new Set(ignoredSubfolders || []);
  
  try {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return { sizeKB: 0, files: 0 };
    }
  } catch {
    return { sizeKB: 0, files: 0 };
  }

  let totalSizeBytes = 0;
  let totalFiles = 0;

  async function processDirectory(dirPath: string, relativePath: string): Promise<void> {
    let entries: import('fs').Dirent[];
    
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      console.error(`Error reading directory ${dirPath}:`, err);
      return;
    }

    for (const entry of entries) {
      const entryName = String(entry.name);
      const fullPath = path.join(dirPath, entryName);
      const relPath = relativePath ? `${relativePath}/${entryName}` : entryName;

      if (IGNORED_DIRS.has(entryName)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Check if this subfolder should be ignored
        if (ignoredSet.has(entryName) || ignoredSet.has(relPath)) {
          continue;
        }
        await processDirectory(fullPath, relPath);
      } else if (entry.isFile()) {
        try {
          // Только stat - НЕ открываем файл
          const fileStat = await fs.stat(fullPath);
          totalSizeBytes += fileStat.size;
          totalFiles += 1;
        } catch (err) {
          console.error(`Error stat file ${fullPath}:`, err);
        }
      }
    }
  }

  await processDirectory(folderPath, '');
  
  // Конвертируем байты в килобайты
  const sizeKB = Math.round(totalSizeBytes / 1024);
  
  return { sizeKB, files: totalFiles };
}
